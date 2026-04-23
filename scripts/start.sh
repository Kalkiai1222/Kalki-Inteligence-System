#!/bin/sh
set -e

echo "==> Running Prisma DB push..."
/app/node_modules/.bin/prisma db push --accept-data-loss

echo "==> Starting Next.js server..."
exec node server.js
