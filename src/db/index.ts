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

// `prepare: false` keeps things compatible with the Supabase transaction
// pooler (PgBouncer) used in production.
//
// `max` must be > 1: postgres-js pipelines concurrent queries onto a single
// connection, which DEADLOCKS on Supabase's transaction pooler (it doesn't
// support pipelining). A small pool lets `Promise.all([...])` queries run on
// separate connections. With max:1 pages like /settings hang forever.
const client =
  globalForDb.__ramenClient ??
  postgres(connectionString, {
    prepare: false,
    max: 10,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__ramenClient = client;
}

export const db = drizzle(client, { schema });
export { schema };
export type Database = typeof db;
