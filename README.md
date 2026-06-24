# 🍜 Cocaramen — Sistema de Gestión de Pedidos

Internal order management system for a ramen delivery business. Built for two
operators to run a real delivery night: fast order entry, soft capacity limits
with manual override, live per-slot/daily utilization, and a clean operational
dashboard.

> **Source code is in English. The entire UI is in Spanish.**

---

## Overview

### Purpose
Manage ramen delivery orders organized into delivery days and time slots, with
**soft** capacity limits that warn (but never block) so operators can knowingly
exceed capacity for operational convenience (same address/building/route).

### Features
- **Operational dashboard** — daily bowl count, daily capacity, remaining
  capacity, per-slot utilization meters, orders grouped by slot, status summary
  and over-capacity indicators. Pick any date.
- **Orders** — create / edit / duplicate / delete, search (customer, address,
  phone), filter by date / slot / status, sorting, quick inline status changes.
- **Live capacity** — the order form previews slot and daily utilization as you
  type, server-authoritative, and prompts **“Confirmar de todos modos”** when a
  soft limit is exceeded.
- **Settings** — daily & per-slot capacity, broth types (create/edit/disable/
  sort), delivery slots (create/edit/disable), and active delivery days.
- **Auth** — login / logout, protected routes, persistent sessions.
- Polished SaaS-style UI: cards, data tables, modals, toasts, confirmation
  dialogs, empty/loading/error states, responsive (desktop + mobile).

### Architecture
| Layer | Choice | Why |
|------|--------|-----|
| Framework | **Next.js 15** (App Router, React 19, TypeScript) | Server Components for reads, Server Actions for writes |
| Styling | **Tailwind CSS v3** + **shadcn/ui** (new-york) | Fast, consistent, accessible primitives |
| ORM / DB access | **Drizzle ORM** + `postgres-js` | One driver connects to **any** Postgres via `DATABASE_URL` |
| Database | **PostgreSQL** (local Docker) / **Supabase Postgres** (prod) | Identical SQL — switching is **env-only**, no code changes |
| Auth | **Supabase Auth** (prod) with a **local dev fallback** | Fully usable locally with only Docker; cloud-ready by flipping `AUTH_MODE` |
| Validation | **Zod** (shared client + server) | Server never trusts the client |
| Tests | **Vitest** (unit + DB integration) | |
| Deploy | **Vercel** (app) + **Supabase** (DB + Auth) | |

**Capacity is soft.** Exceeding a slot or daily limit produces a Spanish warning
and sets flags (`exceeded_slot_capacity`, `exceeded_daily_capacity`,
`over_capacity_approved`, `over_capacity_approved_at`) — it never blocks saving.

---

## Local Setup

### Requirements
**Only Docker + Docker Compose.** (For running scripts/tests outside Docker you
also need Node 22+, but the app itself runs entirely in containers.)

### One command
```bash
cp .env.example .env      # defaults work out of the box (AUTH_MODE=dev)
docker compose up -d
```
This starts three containers and, on the app's first boot, **waits for Postgres,
runs migrations, and seeds the database** automatically.

| Service | URL | Notes |
|---------|-----|-------|
| App (Next.js) | http://localhost:3000 | |
| Adminer (DB UI) | http://localhost:8080 | server `db`, user `ramen`, pass `ramen`, db `cocaramen` |
| PostgreSQL | `localhost:5432` | |

**Login (dev mode):** `operator@cocaramen.local` / `ramen1234`
(also `chef@cocaramen.local` / `ramen1234`). Configurable via `DEV_AUTH_USERS`.

> **Ports already in use?** Override without editing files:
> ```bash
> DB_PORT=5433 APP_PORT=3001 ADMINER_PORT=8081 docker compose up -d
> ```

### Running without Docker (Node on host)
```bash
npm install
# start only Postgres in Docker:
docker compose up -d db
npm run migrate && npm run seed
npm run dev                # http://localhost:3000
```

---

## Database

### Schema
`settings` (key/value config) · `broth_types` (products) · `delivery_slots`
(time windows + capacity) · `orders` · `order_items`. Full DDL lives in
`src/db/schema.ts`; generated SQL migrations in `drizzle/`.

### Commands
```bash
npm run db:generate   # generate a new SQL migration from schema.ts
npm run migrate       # apply migrations  (alias: npm run db:migrate)
npm run seed          # seed reference data (idempotent)  (alias: npm run db:seed)
npm run db:push       # push schema directly (prototyping)
npm run db:studio     # Drizzle Studio
npm run db:reset      # DROP + recreate public schema (dev only) — then migrate & seed
```

### Seed data
- **Broth types:** Caldo de Pollo, Caldo de Pollo Picante, Caldo de Carne, Caldo de Carne Picante
- **Delivery slots:** 21–22, 22–23, 23–00, 00–01 (capacity 6 each)
- **Settings:** daily capacity 24, slot capacity 6, active day = `friday`

The seed is **idempotent** (upserts by natural key) — safe to re-run.

### Reset procedure
```bash
npm run db:reset && npm run migrate && npm run seed
# or, full wipe including the Docker volume:
docker compose down -v && docker compose up -d
```

---

## Development

### Commands
```bash
npm run dev          # dev server
npm run build        # production build
npm start            # run the production build
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit
npm test             # unit tests (no DB needed)
npm run test:integration   # DB integration tests (needs DATABASE_URL)
```

### Folder structure
```
src/
  app/
    (app)/                 # protected, app-shell layout
      page.tsx             # dashboard
      orders/              # list · new · [id]/edit
      settings/            # tabs: capacity · days · broths · slots
    login/                 # public auth page
    layout.tsx · globals.css
  components/
    ui/                    # shadcn/ui primitives
    app-shell/ · orders/ · dashboard/ · settings/
    page-header.tsx · capacity-meter.tsx
  db/                      # schema.ts · index.ts · migrate.ts · seed.ts · reset.ts
  lib/                     # capacity.ts · validation.ts · order-status.ts · dates.ts
       auth/ · supabase/   # auth abstraction (dev + supabase)
  server/                  # settings.ts · queries.ts · capacity-service.ts
       actions/            # orders.ts · settings.ts · auth.ts · capacity.ts
drizzle/                   # generated SQL migrations
tests/  unit/ · integration/
docker/  entrypoint.dev.sh
```

### How capacity works (the core rule)
`src/lib/capacity.ts` is a pure, fully-tested function. The server builds a
snapshot (`buildCapacitySnapshot`) of bowls already booked in the slot and the
day — **excluding cancelled orders, and excluding the order being edited** so it
is never double-counted — then `evaluateCapacity` returns totals, remaining,
exceeded flags, `requiresApproval`, and Spanish warning text. The order action
returns `needsApproval` when a limit is crossed; the UI shows a confirmation
dialog and re-submits with `overCapacityApproved: true`.

---

## Deployment

### Supabase (database + auth)
1. Create a Supabase project.
2. **Database:** copy the pooled connection string (port `6543`) into
   `DATABASE_URL`, then run migrations against it:
   ```bash
   DATABASE_URL="postgresql://...pooler.supabase.com:6543/postgres" npm run migrate
   DATABASE_URL="postgresql://...pooler.supabase.com:6543/postgres" npm run seed
   ```
   No code changes — only the env var differs from local.
3. **Auth:** set `AUTH_MODE=supabase` and provide `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. Create the two
   operator users in the Supabase Auth dashboard.

### Vercel (app)
1. Import the repo into Vercel.
2. Set environment variables: `DATABASE_URL`, `AUTH_MODE=supabase`, and the three
   `SUPABASE_*` keys.
3. Deploy. Run `npm run migrate`/`npm run seed` once against the Supabase DB
   (locally with the prod `DATABASE_URL`, or via a CI step).

### Auth modes
| `AUTH_MODE` | Behavior | Use |
|-------------|----------|-----|
| `dev` (default) | Signed-cookie login against `DEV_AUTH_USERS` — no cloud needed | Local development |
| `supabase` | Supabase Auth (`@supabase/ssr`), session refreshed in middleware | Production |

The data layer is **identical** in both — switching environments is purely env.

---

## Troubleshooting

| Symptom | Fix |
|--------|-----|
| `Bind for 0.0.0.0:5432 failed: port is already allocated` | Another Postgres is running. Use `DB_PORT=5433 APP_PORT=3001 docker compose up -d`. |
| App can't reach DB inside Docker | Inside the compose network the host is **`db`**, not `localhost` (compose injects this automatically). |
| `DATABASE_URL is not set` | Copy `.env.example` → `.env`. |
| Login fails in dev | Check `DEV_AUTH_USERS` (format `email:password,email:password`). Default: `operator@cocaramen.local` / `ramen1234`. |
| Stuck redirecting to `/login` | Dev sessions are signed with `DEV_AUTH_SECRET` (defaults to a constant). Changing it invalidates existing cookies — log in again. |
| Supabase mode errors about missing keys | Set the three `SUPABASE_*` vars, or use `AUTH_MODE=dev` locally. |
| Schema changed but DB stale | `npm run db:generate && npm run migrate` (or `npm run db:push` while prototyping). |
| Reset everything | `docker compose down -v && docker compose up -d`. |

### Debugging
- App logs: `docker compose logs -f app`
- DB shell: `docker exec -it cocaramen-db psql -U ramen -d cocaramen`
- Inspect data: Adminer at http://localhost:8080
- Run tests against the running DB: `DATABASE_URL=... npm run test:integration`

---

## Testing

- **Unit** (`npm test`, no DB): capacity math & soft-limit rules, status state
  machine, date/delivery-day helpers, Zod validation. *(30 tests)*
- **Integration** (`npm run test:integration`, real Postgres): slot & daily bowl
  aggregation, exclusion of cancelled orders, exclusion of the edited order
  (no double-count), over-capacity flagging. *(4 tests)*

```bash
npm test
docker compose up -d db && npm run migrate
DATABASE_URL="postgresql://ramen:ramen@localhost:5432/cocaramen" npm run test:integration
```

---

## Notes on Git
This repository ships with a `.gitignore` but is **not** initialized as a git
repo and no commits have been made — per project policy, all version-control
actions require explicit operator approval.
