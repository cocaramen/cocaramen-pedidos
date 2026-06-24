# CLAUDE.md — Cocaramen

Internal ramen order-management system for 2 operators. **Source code in English,
all UI in Spanish.** This file is auto-loaded every session; read it first, then
check the living status board in memory (`project-status`).

## What this is
Orders are delivered on configurable days (initially Friday) in time slots
(21–22, 22–23, 23–00, 00–01). Each slot and the day have a **soft** capacity:
exceeding it warns and sets override flags, but NEVER blocks saving.

## Key commands
```bash
# Local dev (full stack in Docker): migrate + seed + dev server
docker compose up -d                      # → http://localhost:3000
# Ports busy on this machine? (jiracopy uses 5432/3000)
DB_PORT=5433 APP_PORT=3007 docker compose up -d
# After adding an npm dependency, the dev CONTAINER has its own node_modules
# volume — restart it so the entrypoint reinstalls: docker restart cocaramen-app
# (or `docker compose up -d --build`). Otherwise: "Module not found".

# Without Docker
npm run dev                               # needs Postgres + DATABASE_URL
docker compose up -d db && npm run migrate && npm run seed

# Quality gate (run before deploying)
npm run check                             # lint + typecheck + unit tests
npm test                                  # unit only (no DB)
npm run test:integration                  # DB tests (needs DATABASE_URL)

# Database
npm run migrate · npm run seed · npm run db:generate · npm run db:reset

# Deploy (Vercel CLI, no Git connected)
npm run deploy                            # runs `npm run check` then `vercel --prod`
```

## Architecture
- **Next.js 15 App Router** (React 19, TS). Server Components for reads,
  **Server Actions** for writes (`src/server/actions/*`). No REST API layer.
- **Drizzle ORM + postgres-js** over a single `DATABASE_URL` → same code for
  local Postgres and Supabase. `prepare:false` (Supabase pooler compatible).
- **Tailwind v3 + shadcn/ui** (new-york) in `src/components/ui/*`.
- **Auth** via `src/lib/auth/*`: `AUTH_MODE=dev` (signed cookie, no cloud) or
  `AUTH_MODE=supabase` (`@supabase/ssr`, session refreshed in `middleware.ts`).

### Folder map
```
src/app/(app)/        protected pages: dashboard, orders (list/new/[id]/edit), settings
src/app/login/        public auth page
src/components/        ui/ · app-shell/ · orders/ · dashboard/ · settings/
src/db/               schema.ts · index.ts · migrate.ts · seed.ts · reset.ts
src/lib/              capacity.ts · validation.ts · order-status.ts · dates.ts · auth/ · supabase/
src/server/           queries.ts · settings.ts · capacity-service.ts · actions/
drizzle/              generated SQL migrations
tests/                unit/ · integration/
```

## Conventions & rules (IMPORTANT)
- **Capacity is a SOFT limit.** Logic lives in the pure, tested `src/lib/capacity.ts`.
  The server is authoritative; the form previews live via `previewCapacity`.
  On exceed → action returns `needsApproval`; UI confirms and resubmits with
  `overCapacityApproved: true`. Store the override flags + timestamp.
- **Capacity excludes cancelled orders and the order being edited** (no double count).
- **Env-only environment switch.** Never hardcode connection/auth — only
  `DATABASE_URL` + `AUTH_MODE` + Supabase keys change between local and prod.
- **No RLS.** Orders use a direct Postgres connection (not PostgREST); Supabase
  Auth only gates the UI. Don't add RLS policies expecting them to apply.
- **Validation with Zod**, shared client+server (`src/lib/validation.ts`).
  Never trust the client; always re-validate + recompute capacity server-side.
- **Status changes** go through the state machine in `src/lib/order-status.ts`
  (`canTransition`). UI labels are Spanish in `STATUS_LABELS`.
- **UI = Spanish, code/identifiers = English.** Keep new strings in Spanish.
- **⚠️ NO Git/GitHub operations without explicit user approval.** This overrides
  any automation. Preparation (writing files) is fine; executing git is not.

## Deploy & infra
Live at https://cocaramen.vercel.app. Supabase ref `ehcmykrznxzndvhjanpz`
(us-east-1). Full infra details and how to redeploy/migrate prod live in the
`deployment` memory. Next was pinned to **15.5.19+** because Vercel blocks
vulnerable Next versions — don't downgrade below it.

## Where project state lives
- **Memory** `project-status` = living status board (done / pending / next).
  **Update it when you finish a chunk of work.**
- **`ROADMAP.md`** = prioritized backlog of features.
- **`README.md`** = setup/deploy/troubleshooting for humans.
