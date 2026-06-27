import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. Copy .env.example to .env and configure it.",
  );
}

// Reuse the connection across hot reloads in development to avoid
// exhausting Postgres connections.
const globalForDb = globalThis as unknown as {
  __ramenClient?: ReturnType<typeof postgres>;
};

// Connection tuning for Vercel serverless + Supabase transaction pooler:
//
// - `prepare: false` → compatible with PgBouncer (pooler).
// - `max` MUST be >= the MOST concurrent queries any single page fires in a
//   `Promise.all`. postgres-js pipelines extra concurrent queries onto a shared
//   connection, which DEADLOCKS on the Supabase transaction pooler. The heaviest
//   page (order edit) does ~9 parallel queries, so `max:5` left it sharing
//   connections → intermittent 300s hangs after saving + reopening. `max:12`
//   gives every parallel query its own connection (+ headroom).
// - `idle_timeout` closes idle connections fast so they return to the pooler
//   instead of being hoarded by warm instances — this (not a tiny `max`) is what
//   prevents pooler exhaustion. The transaction pooler is built for many client
//   connections, so 12/instance is fine.
// - `connect_timeout` fails fast instead of hanging when the pooler is busy.
const client =
  globalForDb.__ramenClient ??
  postgres(connectionString, {
    prepare: false,
    max: 12,
    idle_timeout: 20, // seconds
    connect_timeout: 15, // seconds
    max_lifetime: 60 * 30, // recycle connections every 30 min
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__ramenClient = client;
}

export const db = drizzle(client, { schema });
export { schema };
export type Database = typeof db;
