#!/usr/bin/env bash
set -euo pipefail

echo "⏳ Waiting for PostgreSQL to be ready..."
until pg_isready -d "${DATABASE_URL}" >/dev/null 2>&1; do
  sleep 1
done
echo "✅ PostgreSQL is ready."

# Ensure node_modules exists when the project is bind-mounted.
if [ ! -d "node_modules/next" ]; then
  echo "📦 Installing dependencies (bind mount detected)..."
  npm install
fi

echo "🗄️  Running migrations..."
npm run migrate

echo "🌱 Seeding database (idempotent)..."
npm run seed

echo "🚀 Starting Next.js dev server on http://localhost:3000"
exec npm run dev -- --hostname 0.0.0.0
