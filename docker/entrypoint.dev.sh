#!/usr/bin/env bash
set -euo pipefail

echo "⏳ Waiting for PostgreSQL to be ready..."
until pg_isready -d "${DATABASE_URL}" >/dev/null 2>&1; do
  sleep 1
done
echo "✅ PostgreSQL is ready."

# Keep the container's node_modules in sync with package.json on every start.
# npm is a near no-op when nothing changed, and this prevents "module not found"
# after a dependency is added on the host (the container has its own volume).
echo "📦 Ensuring dependencies are in sync..."
npm install --no-audit --no-fund

echo "🗄️  Running migrations..."
npm run migrate

echo "🌱 Seeding database (idempotent)..."
npm run seed

echo "🚀 Starting Next.js dev server on http://localhost:3000"
exec npm run dev -- --hostname 0.0.0.0
