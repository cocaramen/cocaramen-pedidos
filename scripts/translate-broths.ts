import { config } from "dotenv";
config({ path: ".env" });

import postgres from "postgres";

/**
 * One-off, idempotent data migration: rename the original English broth-type
 * names to Spanish. Matches by the old English name, so running it twice (or
 * after a fresh Spanish seed) is a harmless no-op.
 *
 * Usage:
 *   DATABASE_URL=... npx tsx scripts/translate-broths.ts
 */
const RENAMES: { from: string; to: string }[] = [
  { from: "Chicken Broth", to: "Caldo de Pollo" },
  { from: "Spicy Chicken Broth", to: "Caldo de Pollo Picante" },
  { from: "Beef Broth", to: "Caldo de Carne" },
  { from: "Spicy Beef Broth", to: "Caldo de Carne Picante" },
];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set.");

  const sql = postgres(url, { max: 1, prepare: false });
  let changed = 0;
  for (const { from, to } of RENAMES) {
    const res = await sql`UPDATE broth_types SET name = ${to} WHERE name = ${from}`;
    if (res.count > 0) {
      console.log(`  • "${from}" → "${to}"`);
      changed += res.count;
    }
  }
  const rows = await sql`SELECT name FROM broth_types ORDER BY sort_order, name`;
  console.log(`✅ ${changed} renombrado(s). Caldos actuales: ${rows.map((r) => r.name).join(", ")}`);
  await sql.end();
}

main().catch((err) => {
  console.error("❌ Failed:", err);
  process.exit(1);
});
