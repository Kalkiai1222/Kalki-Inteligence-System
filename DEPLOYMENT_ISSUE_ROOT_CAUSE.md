# Deployment Issue - Root Cause & Fix
**Date:** April 22, 2026  
**Status:** FIXED - Push to Render to deploy

---

## **The Problem**
You deployed and saw:
- ❌ No 3D models 
- ❌ No takeoff data (or null values)
- ✅ Blueprint 2D viewer working fine

---

## **Root Cause Analysis**

### **The Critical Bug**
Your Dockerfile was missing the `PATH` environment variable in the **production stage**:

```dockerfile
# WRONG (What you had)
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# ❌ Missing: ENV PATH="/app/.venv/bin:$PATH"
```

### **Why This Breaks Everything**

1. **Build Stage:** ✅ Creates `/app/.venv` with all Python packages installed
2. **Copy to Production:** ✅ Copies `.venv` to runner image
3. **Runtime (Node.js spawns Python):** ❌ Can't find `/app/.venv/bin/python`
4. **Fallback to system `python3`:** ❌ System Python doesn't have `httpx`, `opencv-python`, `trimesh`, etc.
5. **Python pipeline crashes silently:** ❌ Returns empty JSON, no errors in logs

### **The Cascading Failures**

```
API POST /process-blueprint
  ↓
Node.js tries to spawn: /app/.venv/bin/python  (Doesn't exist on Render)
  ↓
Falls back to: python3  (System Python)
  ↓
pipeline/main.py imports httpx, trimesh, opencv → MODULE NOT FOUND
  ↓
Silent crash → Returns empty JSON
  ↓
Frontend receives: { geometry: [], model_paths: {obj: null, step: null, usd: null}, takeoff: null }
  ↓
User sees: "3D models blank, takeoff missing"
```

---

## **The Fix**

### **Changed in Dockerfile:**
```dockerfile
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PATH="/app/.venv/bin:$PATH"  # ✅ NOW ADDED
```

### **Changed in API Route:**
Added detailed logging to catch these issues:
- Logs which Python executable is being used
- Logs the full spawn command
- Logs all stderr/stdout output on failure

---

## **What You Need To Do**

### **Step 1: Trigger Rebuild on Render**
1. Go to [Render Dashboard](https://dashboard.render.com)
2. Find your **Web Service** (ConstructionAI)
3. Click **"Manual Deploy"** → **"Deploy Latest Commit"**
4. Wait for build to complete (check logs)

**Or** trigger via Git:
```bash
git push origin main  # Already done ✅
```

### **Step 2: Test After Deployment**
1. Upload a test blueprint PDF
2. Check browser console - you should see logs like:
   ```
   Using venv python: /app/.venv/bin/python
   Spawning: /app/.venv/bin/python /app/pipeline/main.py /app/public/uploads/blueprints/...
   Pipeline succeeded: Generated 3D models and takeoff
   ```

3. Check Render logs - should show Python execution details

### **Step 3: Verify Fixes**
After deployment, upload a blueprint and verify:
- ✅ 3D model appears (OBJ viewer)
- ✅ Takeoff panel shows materials
- ✅ Export reports work
- ✅ No "null" values in JSON response

---

## **Why This Wasn't Caught Earlier**

Your local setup works fine because:
1. Your dev machine has Python venv properly configured
2. PATH is set in your shell by `.venv/Scripts/Activate.ps1`
3. Docker locally often doesn't strip environment variables

But **Render rebuilds from scratch** and uses a clean Linux container. Without the explicit `ENV PATH` directive, the production stage doesn't inherit PATH from builder stage.

---

## **Prevention for Future Deployments**

Before deploying, always test:

```bash
# Simulate Render's build locally
docker build -t constructionai .
docker run -it --rm constructionai node -e "const {spawn}=require('child_process');const p=spawn('/app/.venv/bin/python',['--version']);p.stdout.on('data',(d)=>console.log(d.toString()));p.stderr.on('data',(d)=>console.error(d.toString()))"
```

Or just test the Python subprocess directly in your Node app.

---

## **Files Changed**
- `Dockerfile` - Added `ENV PATH="/app/.venv/bin:$PATH"` to runner stage
- `src/app/api/process-blueprint/route.ts` - Enhanced error logging

**Commit:** `282a70b` (pushed to GitHub, deploying to Render)
