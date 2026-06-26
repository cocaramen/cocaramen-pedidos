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
// - `max` MUST be > 1: postgres-js pipelines concurrent queries onto a single
//   connection, which DEADLOCKS on the transaction pooler (no pipelining). A
//   small pool lets `Promise.all([...])` run on separate connections. But it
//   must also stay SMALL: every warm serverless instance keeps its own pool,
//   so a big `max` × many instances exhausts the pooler (queries then hang
//   until they hit statement_timeout / the 300s function limit). 5 is a safe
//   middle ground (no deadlock, low pressure).
// - `idle_timeout` closes idle connections fast so they return to the pooler
//   instead of being hoarded by warm instances.
// - `connect_timeout` fails fast instead of hanging when the pooler is busy.
const client =
  globalForDb.__ramenClient ??
  postgres(connectionString, {
    prepare: false,
    max: 5,
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
