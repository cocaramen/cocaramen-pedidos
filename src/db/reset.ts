import { config } from "dotenv";
config({ path: ".env" });

import postgres from "postgres";

/**
 * Drops the public schema and recreates it — wiping ALL data and tables.
 * Run `npm run migrate && npm run seed` afterwards to rebuild.
 */
async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set.");

  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to reset the database in production.");
  }

  const client = postgres(connectionString, { max: 1, prepare: false });
  console.log("⚠️  Dropping and recreating the public schema...");
  await client`DROP SCHEMA public CASCADE`;
  await client`CREATE SCHEMA public`;
  console.log("✅ Schema reset. Run `npm run migrate && npm run seed`.");
  await client.end();
}

main().catch((err) => {
  console.error("❌ Reset failed:", err);
  process.exit(1);
});
