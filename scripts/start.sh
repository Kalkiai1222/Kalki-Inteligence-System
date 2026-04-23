#!/bin/sh
set -e

echo "==> Running Prisma DB push..."
node /app/node_modules/prisma/build/index.js db push --accept-data-loss

echo "==> Starting Next.js server..."
exec node /app/server.js
