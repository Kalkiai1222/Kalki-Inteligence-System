# ConstructionAI - Render Deployment Guide

## Overview
This guide walks you through deploying ConstructionAI to [Render](https://render.com), a modern cloud platform that supports both Node.js (Next.js) and Python services.

Since this project is a **hybrid Next.js + Python** application, we'll deploy:
1. **Next.js Frontend/API** → Render Web Service
2. **Python Pipeline** → Integrated via child_process or separate service
3. **PostgreSQL Database** → Render Postgres Service
4. **File Storage** → Render Disk or AWS S3

---

## Prerequisites

1. **Render Account:** Sign up at https://render.com
2. **GitHub Repository:** Push your code to GitHub (Render integrates via GitHub)
3. **Environment Variables:** Prepare `.env` file with all secrets
4. **Optional:** AWS S3 credentials for file storage (or use local disk)

---

## Architecture Options

### Option 1: Single Next.js Service with Python (Recommended for Phase 1)
- One Render Web Service running Node.js + Next.js
- Python scripts run as child processes via `child_process`
- Shared filesystem for Python virtual environment
- **Pros:** Simple, no inter-service networking, cost-effective
- **Cons:** Python runs in same container, limited to Node.js build environment

### Option 2: Separate Python Worker Service (Recommended for Production)
- Next.js API on Render Web Service
- Python worker on separate Render Background Job
- Async job queue (e.g., Bull with Redis)
- **Pros:** Better scalability, true microservices
- **Cons:** More complex setup, requires job queue

**This guide focuses on Option 1 for simplicity. Option 2 can be added later.**

---

## Step 1: Prepare Repository

### 1.1 Create `.env.production` 
Create a file in the root directory with production environment variables:

```bash
# Database
DATABASE_URL=postgresql://[user]:[password]@[host]:5432/constructionai

# Authentication
JWT_SECRET=[generate-a-strong-random-secret]
NODE_ENV=production

# Storage
STORAGE_DRIVER=s3  # or 'local' for Render disk
AWS_ACCESS_KEY_ID=[your-aws-key]
AWS_SECRET_ACCESS_KEY=[your-aws-secret]
AWS_S3_BUCKET=constructionai-prod
AWS_REGION=us-east-1

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=[your-email@gmail.com]
SMTP_PASSWORD=[app-password]
SMTP_FROM=noreply@constructionai.com

# LLM (Groq for material takeoff)
GROQ_API_KEY=[your-groq-api-key]

# App
NEXT_PUBLIC_APP_URL=https://[your-render-domain].onrender.com
PORT=3000
```

### 1.2 Update `.gitignore`
Ensure sensitive files aren't tracked:
```bash
.env
.env.local
.env.production.local
.venv/
__pycache__/
*.pyc
node_modules/
.next/
public/uploads/*
```

### 1.3 Create Render Build Script
Create `render-build.sh` in the root:

```bash
#!/bin/bash
set -e

# Install Node dependencies
npm ci

# Generate Prisma client
npx prisma generate

# Install Python dependencies (if needed)
pip install -r requirements.txt

# Build Next.js
npm run build

# Push database schema
npx prisma db push --skip-generate
```

Make it executable:
```bash
chmod +x render-build.sh
```

### 1.4 Update `package.json` Build & Start Scripts
Ensure these are configured:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start -p ${PORT:-3000}",
    "lint": "eslint"
  }
}
```

---

## Step 2: Create Render Services via Dashboard

### 2.1 Create PostgreSQL Database

1. Go to Render Dashboard → **Databases** → **New Database**
2. **Configuration:**
   - **Name:** `constructionai-db`
   - **Database:** PostgreSQL
   - **Version:** Latest (15.x+)
   - **Region:** Same as your Web Service
   - **Plan:** Free or paid (Free has limitations)

3. **After creation:**
   - Copy the `External Database URL` (format: `postgresql://user:pass@host:5432/db`)
   - Save this for the Web Service environment variables

### 2.2 Create Next.js Web Service

1. Go to **Render Dashboard** → **New+** → **Web Service**
2. **Connect Your Repository:**
   - Select your GitHub repo
   - Authorize Render to access GitHub if prompted

3. **Configuration:**
   - **Name:** `constructionai-api`
   - **Environment:** Node
   - **Region:** US (or your preferred region)
   - **Branch:** `main` (or your deployment branch)
   - **Build Command:** `./render-build.sh`
   - **Start Command:** `npm start`
   - **Plan:** Standard ($7/mo) or higher

4. **Set Environment Variables** (click **Advanced** → **Environment**)
   
   Add all variables from your `.env.production`:
   ```
   DATABASE_URL=[your-postgres-url-from-step-2.1]
   JWT_SECRET=[generate-strong-secret]
   NODE_ENV=production
   GROQ_API_KEY=[your-groq-key]
   STORAGE_DRIVER=local
   NEXT_PUBLIC_APP_URL=https://[service-name].onrender.com
   PORT=3000
   ```

5. **Health Check:**
   - **Path:** `/api/health` (optional — create this endpoint in Next.js)
   - **Interval:** 60 seconds
   - **Timeout:** 10 seconds

6. **Click Deploy**
   - Render will clone your repo and start the build
   - Watch the build logs to ensure it completes

---

## Step 3: Handle Python Environment

### Option A: Python via Node Child Process (Recommended for Phase 1)

Since your code already uses `child_process` to call Python scripts, this should work, but you need to ensure Python dependencies are installed.

1. **Update `.render-build.sh`** to include Python setup:

```bash
#!/bin/bash
set -e

echo "=== Installing Node dependencies ==="
npm ci

echo "=== Generating Prisma client ==="
npx prisma generate

echo "=== Installing Python dependencies ==="
apt-get update
apt-get install -y python3 python3-pip python3-venv
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip setuptools wheel
pip install -r requirements.txt

echo "=== Building Next.js ==="
npm run build

echo "=== Pushing Prisma migrations ==="
npx prisma db push --skip-generate

echo "=== Build complete ==="
```

2. **Update `start` script in `package.json`:**

```json
{
  "scripts": {
    "start": "source .venv/bin/activate && next start -p ${PORT:-3000}"
  }
}
```

**⚠️ Note:** Render uses Alpine Linux by default, which has limited Python support. Consider using a custom Dockerfile (see Step 4).

---

## Step 4: (Advanced) Use Custom Dockerfile for Python Support

If you need better Python support, use a custom Dockerfile:

### Create `Dockerfile.render`

```dockerfile
# Multi-stage build: Node + Python
FROM python:3.11-slim AS base

# Install Node.js
RUN apt-get update && apt-get install -y nodejs npm && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install Node dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy Prisma schema
COPY prisma ./prisma
RUN npx prisma generate

# Copy application
COPY . .

# Build Next.js
RUN npm run build

# Expose port
EXPOSE 3000

# Set environment
ENV NODE_ENV=production
ENV PYTHONUNBUFFERED=1

# Start Next.js
CMD ["npm", "start"]
```

### Deploy with Custom Dockerfile:

1. In Render Web Service settings:
   - **Build Command:** Leave blank (Dockerfile will be used)
   - **Start Command:** Leave blank (use ENTRYPOINT from Dockerfile)

2. Or create `render.yaml` in your root:

```yaml
services:
  - type: web
    name: constructionai-api
    env: dockerfile
    dockerfilePath: ./Dockerfile.render
    envVars:
      - key: DATABASE_URL
        fromDatabase:
          name: constructionai-db
          property: connectionString
      - key: NODE_ENV
        value: production
```

Then deploy with:
```bash
render deploy -f render.yaml
```

---

## Step 5: Database Migrations

After deployment, run Prisma migrations:

1. **One-time setup via SSH (if available):**
   ```bash
   npx prisma db push
   ```

2. **Or add to your `render-build.sh`** (done in Step 2.3)

3. **Seed initial data (optional):**
   ```bash
   npm run seed
   ```

---

## Step 6: File Storage Configuration

### Option A: Local Disk (Simple)
- Files stored in `/app/public/uploads`
- Renders to `/app/public` web root
- ⚠️ **Limitation:** Render disks are ephemeral; files are lost on redeploy

### Option B: AWS S3 (Recommended)

1. **Create S3 Bucket:**
   ```bash
   aws s3 mb s3://constructionai-prod
   ```

2. **Create IAM User with S3 permissions:**
   - AWS Console → IAM → Users → Create User
   - Attach policy: `AmazonS3FullAccess` (or more restrictive)
   - Create Access Keys (save AWS_ACCESS_KEY_ID & AWS_SECRET_ACCESS_KEY)

3. **Update Render Environment Variables:**
   ```
   STORAGE_DRIVER=s3
   AWS_ACCESS_KEY_ID=[key]
   AWS_SECRET_ACCESS_KEY=[secret]
   AWS_S3_BUCKET=constructionai-prod
   AWS_REGION=us-east-1
   ```

4. **Update your storage code** (e.g., in `src/lib/storage.ts`):
   ```typescript
   // This should already be configured in your codebase
   // Just ensure AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are set
   ```

---

## Step 7: Configure Custom Domain (Optional)

1. Go to **Web Service Settings** → **Custom Domain**
2. Add your domain (e.g., `api.constructionai.com`)
3. Add CNAME record to your DNS:
   - **CNAME:** `api.constructionai.com` → `constructionai-api.onrender.com`
4. Render will auto-provision SSL/TLS certificate

---

## Step 8: Monitoring & Debugging

### View Logs
- Render Dashboard → Web Service → **Logs**
- Filter by build, runtime, or errors

### Common Issues

#### Build Fails: Python Modules Not Found
- **Issue:** Alpine-based Node image lacks Python build tools
- **Solution:** Use custom Dockerfile with Python base image (Step 4)

#### Database Connection Refused
- **Issue:** DATABASE_URL not set or incorrect
- **Solution:** 
  - Verify PostgreSQL service is running
  - Check DATABASE_URL format: `postgresql://user:pass@host:5432/db`

#### Python Scripts Not Executing
- **Issue:** `.venv` not activated in production
- **Solution:** 
  - Use Dockerfile approach (Step 4)
  - Or ensure `start` script activates venv

#### Out of Memory (OOM Killer)
- **Issue:** Trimesh/FAISS operations are memory-intensive
- **Solution:** 
  - Upgrade Render plan to higher tier
  - Optimize mesh processing (add LOD/streaming)
  - Cache FAISS indices

---

## Step 9: Environment Variables Checklist

Before deploying, ensure you have:

- [ ] `DATABASE_URL` - PostgreSQL connection string
- [ ] `JWT_SECRET` - Strong random secret (run: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)
- [ ] `NODE_ENV=production`
- [ ] `GROQ_API_KEY` - If using LLM material takeoff
- [ ] `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` - Email configuration
- [ ] `NEXT_PUBLIC_APP_URL` - Your Render domain
- [ ] `PORT=3000` - Match Render's expected port
- [ ] `STORAGE_DRIVER` - `local` or `s3`
- [ ] AWS credentials (if using S3)

---

## Step 10: Deployment Checklist

- [ ] Repository pushed to GitHub
- [ ] `render-build.sh` created and committed
- [ ] PostgreSQL service created on Render
- [ ] Web Service created and linked to GitHub repo
- [ ] All environment variables configured
- [ ] Build completed successfully
- [ ] Health checks passing
- [ ] Database migrations ran
- [ ] Test endpoints respond: `/api/health`, `/api/auth/login`, etc.
- [ ] 3D model generation works (upload test blueprint)
- [ ] File uploads persist (check S3 or disk)

---

## Step 11: CI/CD Pipeline (Automatic Deploys)

Render auto-deploys on every push to your configured branch. To modify:

1. Go to **Web Service Settings** → **Deployment Trigger**
2. Disable auto-deploy if needed
3. Or add webhook to trigger manual builds

---

## Cost Estimation

| Service | Tier | Monthly Cost |
|---------|------|------------|
| Web Service (Node.js) | Standard | $7 |
| PostgreSQL Database | Free/Starter | Free / $15+ |
| Custom Domain | - | Free |
| **Total** | - | **$7-22+** |

*Pricing as of 2026. Check Render pricing page for updates.*

---

## Production Checklist

- [ ] Enable HTTPS only (auto-configured by Render)
- [ ] Set strong `JWT_SECRET`
- [ ] Rotate API keys (Groq, AWS, SMTP)
- [ ] Enable database backups (Render Postgres)
- [ ] Monitor error logs regularly
- [ ] Set up error tracking (Sentry integration optional)
- [ ] Test disaster recovery (restore from DB backup)
- [ ] Load test the application
- [ ] Set up alerts for CPU/memory usage

---

## Scaling Considerations

### When to Scale
- If Python processing times exceed 30s → Separate worker service (Option 2)
- If file uploads large → Enable chunked upload + S3
- If concurrent users > 100 → Upgrade Render plan

### Future Enhancements
1. **Celery + Redis Worker:** Move Python pipeline to async job queue
2. **CloudFront CDN:** Cache 3D models and blueprints
3. **Lambda Functions:** Process webhooks for file uploads
4. **Multi-region replication:** Deploy to EU region for latency

---

## Support & Resources

- **Render Docs:** https://render.com/docs
- **Next.js Deployment:** https://nextjs.org/docs/deployment
- **Prisma Deployment:** https://www.prisma.io/docs/orm/more/deployment
- **ConstructionAI DEVELOPER_GUIDE:** See `DEVELOPER_GUIDE.md`

---

## Quick Deploy Command (One-Liner)

Once setup, future deployments are automatic on git push:
```bash
git add .
git commit -m "Production deployment"
git push origin main
```

Render will automatically detect changes and redeploy.

---

**Last Updated:** April 2026
**Phase:** ConstructionAI Phase 1
