# Deployment Error Fixes - April 23, 2026

## Errors Fixed

### 1. BOM Character in start.sh
**Error:** `/app/start.sh: 1: ﻿#!/bin/sh: not found`

**Root Cause:** The `/app/scripts/start.sh` file had a UTF-8 Byte Order Mark (BOM) at the beginning, making the shebang invalid in Docker.

**Solution:** 
- Removed BOM from `scripts/start.sh`
- Changed Prisma CLI path from `/app/node_modules/.bin/prisma` to `node /app/node_modules/prisma/build/index.js`
- Updated Dockerfile to copy the fixed script and strip any line ending issues with `sed`

### 2. Missing Prisma WASM File
**Error:** `Error: ENOENT: no such file or directory, open '/app/node_modules/.bin/prisma_schema_build_bg.wasm'`

**Root Cause:** The bundled Prisma wrapper script at `/app/node_modules/.bin/prisma` expects the WASM file to be in `.bin/`, but it's not. This is a known limitation of the wrapper approach.

**Solution:**
- Changed start.sh to invoke the Prisma CLI directly via `node /app/node_modules/prisma/build/index.js db push --accept-data-loss`
- This bypasses the wrapper and uses the real CLI entry point which properly locates all dependencies
- The Dockerfile already copies all necessary Prisma files: `.prisma/`, `@prisma/`, and `prisma/`

## Files Modified

### scripts/start.sh
- Removed UTF-8 BOM
- Fixed Prisma CLI invocation path
- Changed `node server.js` to `node /app/server.js` (absolute path for clarity)

### Dockerfile
- Updated the COPY command for start.sh to strip any line ending issues
- Uses `dos2unix` if available, falls back to `sed` for CRLF removal

## Deployment Process

The Docker build now:
1. Installs dependencies and runs `prisma generate` in the deps stage
2. Copies generated Prisma files to node_modules
3. Properly fixes start.sh line endings before container starts
4. Invokes Prisma via the direct CLI entry point instead of the wrapper

## Testing Locally

To verify the fixes work:

```bash
# Build locally
docker build -t construction-ai:test .

# Run container
docker run -it construction-ai:test /bin/sh

# Inside container, verify:
ls -la /app/start.sh
head -1 /app/start.sh  # Should show #!/bin/sh
node /app/node_modules/prisma/build/index.js --version
```

## Related Issues Fixed

- Prisma database migrations now properly execute before server starts
- Start script has valid Unix line endings (LF only, no BOM)
- Explicit Prisma CLI path eliminates wrapper dependency issues
