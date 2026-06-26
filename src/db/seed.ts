import { config } from "dotenv";
config({ path: ".env" });

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sql } from "drizzle-orm";
import * as schema from "./schema";
import { SETTING_KEYS } from "./schema";

// priceCents = ARS centavos (e.g. 1200000 = $12.000). Set on insert only.
const PRODUCTS = [
  { name: "Caldo de Pollo", category: "Ramen", priceCents: 1200000, sortOrder: 1 },
  { name: "Caldo de Pollo Picante", category: "Ramen", priceCents: 1200000, sortOrder: 2 },
  { name: "Caldo de Carne", category: "Ramen", priceCents: 1300000, sortOrder: 3 },
  { name: "Caldo de Carne Picante", category: "Ramen", priceCents: 1300000, sortOrder: 4 },
];

// Volume discounts: "from N units of a category, X% off". discountBps = basis
// points (625 = 6.25%). Example offers; edit/disable in Settings.
const VOLUME_DISCOUNTS = [
  { category: "Ramen", minQuantity: 2, discountBps: 625 },
  { category: "Ramen", minQuantity: 4, discountBps: 940 },
];

const PAYMENT_METHODS = [
  { name: "Efectivo", sortOrder: 1 },
  { name: "Transferencia", sortOrder: 2, requiresReceipt: true },
];

const SHIPPING_METHODS = [
  { name: "Vehículo de Pablo", sortOrder: 1 },
  { name: "Vehículo propio", sortOrder: 2 },
  { name: "PedidosYa", sortOrder: 3 },
  { name: "Uber Envíos", sortOrder: 4 },
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
  // Delivery origin (kitchen) — editable in Settings.
  { key: SETTING_KEYS.ORIGIN_ADDRESS, value: "Avenida Mate de Luna 2214, San Miguel de Tucumán, Tucumán" },
  { key: SETTING_KEYS.ORIGIN_LAT, value: "-26.82548" },
  { key: SETTING_KEYS.ORIGIN_LNG, value: "-65.23091" },
  // Address-autocomplete search area (order form).
  { key: SETTING_KEYS.SEARCH_LABEL, value: "San Miguel de Tucumán" },
  { key: SETTING_KEYS.SEARCH_CENTER_LAT, value: "-26.8333" },
  { key: SETTING_KEYS.SEARCH_CENTER_LNG, value: "-65.2167" },
  { key: SETTING_KEYS.SEARCH_RADIUS_KM, value: "10" },
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

  // Products — upsert by name; only update sort/category on conflict so an
  // operator-edited price is never overwritten on reseed.
  const slotCapacity = Number(
    SETTINGS.find((s) => s.key === SETTING_KEYS.DEFAULT_SLOT_CAPACITY)?.value ?? "6",
  );
  for (const p of PRODUCTS) {
    await db
      .insert(schema.products)
      .values(p)
      .onConflictDoUpdate({
        target: schema.products.name,
        set: { sortOrder: p.sortOrder, category: p.category },
      });
  }
  console.log(`  • products: ${PRODUCTS.length} ensured`);

  // Volume discounts — upsert by (category, minQuantity).
  for (const d of VOLUME_DISCOUNTS) {
    await db
      .insert(schema.volumeDiscounts)
      .values(d)
      .onConflictDoUpdate({
        target: [schema.volumeDiscounts.category, schema.volumeDiscounts.minQuantity],
        set: { discountBps: d.discountBps },
      });
  }
  console.log(`  • volume_discounts: ${VOLUME_DISCOUNTS.length} ensured`);

  // Payment methods — upsert by name
  for (const m of PAYMENT_METHODS) {
    await db
      .insert(schema.paymentMethods)
      .values(m)
      .onConflictDoUpdate({
        target: schema.paymentMethods.name,
        set: { sortOrder: m.sortOrder },
      });
  }
  console.log(`  • payment_methods: ${PAYMENT_METHODS.length} ensured`);

  // Shipping methods — upsert by name
  for (const m of SHIPPING_METHODS) {
    await db
      .insert(schema.shippingMethods)
      .values(m)
      .onConflictDoUpdate({
        target: schema.shippingMethods.name,
        set: { sortOrder: m.sortOrder },
      });
  }
  console.log(`  • shipping_methods: ${SHIPPING_METHODS.length} ensured`);

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
    sql`SELECT count(*)::int AS count FROM products`,
  );
  console.log(`✅ Seed complete. (products rows: ${count})`);

  await client.end();
}

main().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
