import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { config } from "dotenv";
config({ path: ".env" });

import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { and, eq, ne, sql } from "drizzle-orm";
import * as schema from "@/db/schema";
import { evaluateCapacity } from "@/lib/capacity";

const HAS_DB = Boolean(process.env.DATABASE_URL);
const suite = HAS_DB ? describe : describe.skip;

if (!HAS_DB) {
  // eslint-disable-next-line no-console
  console.warn("⏭️  Skipping DB integration tests — DATABASE_URL is not set.");
}

suite("capacity calculations against a real database", () => {
  let client: ReturnType<typeof postgres>;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let slotId: string;
  let otherSlotId: string;
  let brothId: string;
  const date = "2099-01-01"; // far-future date to avoid colliding with seed/usage
  const createdOrderIds: string[] = [];

  async function bowls(opts: { slotId?: string; excludeOrderId?: string }) {
    const conditions = [
      eq(schema.orders.deliveryDate, date),
      sql`${schema.orders.status} <> 'cancelled'`,
    ];
    if (opts.slotId) conditions.push(eq(schema.orders.deliverySlotId, opts.slotId));
    if (opts.excludeOrderId) conditions.push(ne(schema.orders.id, opts.excludeOrderId));
    const [row] = await db
      .select({ total: sql<number>`coalesce(sum(${schema.orderItems.quantity}),0)::int` })
      .from(schema.orders)
      .innerJoin(schema.orderItems, eq(schema.orderItems.orderId, schema.orders.id))
      .where(and(...conditions));
    return row?.total ?? 0;
  }

  async function makeOrder(
    targetSlot: string,
    qty: number,
    status: schema.OrderStatus = "pending",
  ) {
    const [o] = await db
      .insert(schema.orders)
      .values({
        customerName: "Test",
        customerPhone: "+34 600000000",
        customerAddress: "Test address",
        deliveryDate: date,
        deliverySlotId: targetSlot,
        status,
        totalBowls: qty,
      })
      .returning({ id: schema.orders.id });
    await db
      .insert(schema.orderItems)
      .values({ orderId: o.id, brothTypeId: brothId, quantity: qty });
    createdOrderIds.push(o.id);
    return o.id;
  }

  beforeAll(async () => {
    client = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });
    db = drizzle(client, { schema });

    await migrate(db, { migrationsFolder: "./drizzle" });

    const [slotA] = await db
      .insert(schema.deliverySlots)
      .values({
        label: `TEST-A-${Date.now()}`,
        startTime: "21:00:00",
        endTime: "22:00:00",
        capacityLimit: 6,
        sortOrder: 900,
      })
      .returning({ id: schema.deliverySlots.id });
    const [slotB] = await db
      .insert(schema.deliverySlots)
      .values({
        label: `TEST-B-${Date.now()}`,
        startTime: "22:00:00",
        endTime: "23:00:00",
        capacityLimit: 6,
        sortOrder: 901,
      })
      .returning({ id: schema.deliverySlots.id });
    const [broth] = await db
      .insert(schema.brothTypes)
      .values({ name: `TEST-Broth-${Date.now()}`, sortOrder: 900 })
      .returning({ id: schema.brothTypes.id });

    slotId = slotA.id;
    otherSlotId = slotB.id;
    brothId = broth.id;
  });

  afterAll(async () => {
    if (!db) return;
    for (const id of createdOrderIds) {
      await db.delete(schema.orders).where(eq(schema.orders.id, id));
    }
    await db.delete(schema.deliverySlots).where(eq(schema.deliverySlots.id, slotId));
    await db.delete(schema.deliverySlots).where(eq(schema.deliverySlots.id, otherSlotId));
    await db.delete(schema.brothTypes).where(eq(schema.brothTypes.id, brothId));
    await client.end();
  });

  it("sums slot and daily bowls across orders", async () => {
    await makeOrder(slotId, 4);
    await makeOrder(otherSlotId, 3);

    expect(await bowls({ slotId })).toBe(4);
    expect(await bowls({})).toBe(7);
  });

  it("excludes cancelled orders from capacity", async () => {
    await makeOrder(slotId, 5, "cancelled");
    // slot still 4 (cancelled ignored)
    expect(await bowls({ slotId })).toBe(4);
  });

  it("flags slot over-capacity via evaluateCapacity", async () => {
    const slotBowls = await bowls({ slotId }); // 4
    const dailyBowls = await bowls({}); // 7
    const e = evaluateCapacity(
      { slotBowls, dailyBowls, slotCapacity: 6, dailyCapacity: 24 },
      3,
    );
    expect(e.newSlotTotal).toBe(7);
    expect(e.exceededSlotCapacity).toBe(true);
    expect(e.requiresApproval).toBe(true);
  });

  it("excludes the edited order to avoid double-counting", async () => {
    const editId = await makeOrder(slotId, 2); // slot now 6
    const all = await bowls({ slotId }); // 6
    const excluding = await bowls({ slotId, excludeOrderId: editId }); // 4
    expect(all).toBe(6);
    expect(excluding).toBe(4);

    // Re-saving the edited order with 2 bowls should NOT be over capacity.
    const e = evaluateCapacity(
      { slotBowls: excluding, dailyBowls: 0, slotCapacity: 6, dailyCapacity: 24 },
      2,
    );
    expect(e.exceededSlotCapacity).toBe(false);
  });
});
