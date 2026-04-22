# Construction AI

Construction AI is a SaaS platform designed for construction management. It allows users to create companies, invite team members, manage projects, and store and share blueprints securely.

## Features

- **Company & Project Management:** Create workspaces for clients, add members with Role-Based Access Control (RBAC).
- **Audit Logs:** Full traceability for admin activities.
- **Role-Based Notifications:** User alerts for system events.
- **3D Blueprint Viewer:** Render Step/DXF files directly in browser.
- **Secure File Storage:** Upload management using Local Storage or AWS S3 integration.

## Getting Started For Development

1. **Clone & Install**
   ``bash
   npm install
   ``

2. **Environment Variables**
   Duplicate .env.example as .env and fill out your secrets:
   ``bash
   cp .env.example .env
   ``

3. **Database Setup**
   Push the schema to your SQLite (or configured) database.
   ``bash
   npx prisma db push
   npm run seed        # (Optional) Seed database with demo data
   ``

4. **Run Server**
   ``bash
   npm run dev
   ``

## Production Deployment (Docker)

The application is fully containerized and runs out of the box using docker-compose. 

1. Ensure .env is configured properly (including JWT_SECRET).
2. Run the application with Docker:
   ``bash
   docker compose up --build -d
   ``

### Architecture Notes

- **Framework:** Next.js 16 (App Router)
- **Database:** Prisma ORM
- **Auth:** Custom JWT Authentication Strategy
- **Styling:** Tailwind CSS

## Continuous Integration

Configured via GitHub Actions .github/workflows/ci-cd.yml covering automatic linting and test builds. 
# Kalki-Inteligence-System
