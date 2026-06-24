import { config } from "dotenv";
config({ path: ".env" });

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sql } from "drizzle-orm";
import * as schema from "./schema";
import { SETTING_KEYS } from "./schema";

const BROTH_TYPES = [
  { name: "Caldo de Pollo", sortOrder: 1 },
  { name: "Caldo de Pollo Picante", sortOrder: 2 },
  { name: "Caldo de Carne", sortOrder: 3 },
  { name: "Caldo de Carne Picante", sortOrder: 4 },
];

const DELIVERY_SLOTS = [
  { label: "21:00 - 22:00", startTime: "21:00:00", endTime: "22:00:00", sortOrder: 1 },
  { label: "22:00 - 23:00", startTime: "22:00:00", endTime: "23:00:00", sortOrder: 2 },
  { label: "23:00 - 00:00", startTime: "23:00:00", endTime: "00:00:00", sortOrder: 3 },
  { label: "00:00 - 01:00", startTime: "00:00:00", endTime: "01:00:00", sortOrder: 4 },
];

const SETTINGS = [
  { key: SETTING_KEYS.DEFAULT_SLOT_CAPACITY, value: "6" },
  { key: SETTING_KEYS.DEFAULT_DAILY_CAPACITY, value: "24" },
  { key: SETTING_KEYS.ACTIVE_DELIVERY_DAYS, value: "friday" },
];

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set.");

  const client = postgres(connectionString, { max: 1, prepare: false });
  const db = drizzle(client, { schema });

  console.log("🌱 Seeding database (idempotent)...");

  // Settings — upsert by key
  for (const s of SETTINGS) {
    await db
      .insert(schema.settings)
      .values(s)
      .onConflictDoUpdate({ target: schema.settings.key, set: { value: s.value } });
  }
  console.log(`  • settings: ${SETTINGS.length} ensured`);

  // Broth types — upsert by name, only set defaults on insert
  const slotCapacity = Number(
    SETTINGS.find((s) => s.key === SETTING_KEYS.DEFAULT_SLOT_CAPACITY)?.value ?? "6",
  );
  for (const b of BROTH_TYPES) {
    await db
      .insert(schema.brothTypes)
      .values(b)
      .onConflictDoUpdate({
        target: schema.brothTypes.name,
        set: { sortOrder: b.sortOrder },
      });
  }
  console.log(`  • broth_types: ${BROTH_TYPES.length} ensured`);

  // Delivery slots — upsert by label
  for (const slot of DELIVERY_SLOTS) {
    await db
      .insert(schema.deliverySlots)
      .values({ ...slot, capacityLimit: slotCapacity })
      .onConflictDoUpdate({
        target: schema.deliverySlots.label,
        set: {
          startTime: slot.startTime,
          endTime: slot.endTime,
          sortOrder: slot.sortOrder,
        },
      });
  }
  console.log(`  • delivery_slots: ${DELIVERY_SLOTS.length} ensured`);

  const [{ count }] = await db.execute<{ count: number }>(
    sql`SELECT count(*)::int AS count FROM broth_types`,
  );
  console.log(`✅ Seed complete. (broth_types rows: ${count})`);

  await client.end();
}

main().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
