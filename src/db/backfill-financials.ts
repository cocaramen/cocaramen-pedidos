import { config } from "dotenv";
config({ path: ".env" });

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq, isNull } from "drizzle-orm";
import * as schema from "./schema";
import { computeOrderSnapshot } from "../lib/costing";

/**
 * One-off (idempotent) backfill: freezes an APPROXIMATE financial snapshot on
 * orders that never got one (pricedAt IS NULL — i.e. created before Fase 1),
 * using the CURRENT product prices/costs and active volume discounts. Leaves
 * pricedAt NULL so these stay flagged as approximate; editing an order later
 * sets a real pricedAt. Safe to re-run.
 */
async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set.");

  const client = postgres(connectionString, { max: 1, prepare: false });
  const db = drizzle(client, { schema });

  const products = await db.query.products.findMany();
  const tiers = await db.query.volumeDiscounts.findMany({
    where: eq(schema.volumeDiscounts.isActive, true),
  });
  const pmap = new Map(products.map((p) => [p.id, p]));
  const tierInput = tiers.map((t) => ({
    category: t.category,
    minQuantity: t.minQuantity,
    discountBps: t.discountBps,
    isActive: t.isActive,
  }));

  const pending = await db.query.orders.findMany({
    where: isNull(schema.orders.pricedAt),
    with: { items: true },
  });
  console.log(`🧮 Backfilling ${pending.length} pedido(s) sin snapshot...`);

  for (const o of pending) {
    const items = o.items
      .filter((i) => pmap.has(i.productId))
      .map((i) => {
        const p = pmap.get(i.productId)!;
        return {
          product: { priceCents: p.priceCents, costCents: p.costCents, category: p.category },
          quantity: i.quantity,
        };
      });
    const snap = computeOrderSnapshot(items, tierInput);

    await db
      .update(schema.orders)
      .set({
        subtotalCents: snap.subtotalCents,
        discountCents: snap.discountCents,
        totalCents: snap.totalCents,
        goodsCostCents: snap.goodsCostCents,
        // pricedAt stays NULL on purpose → marks the snapshot as approximate.
      })
      .where(eq(schema.orders.id, o.id));

    for (const i of o.items) {
      const p = pmap.get(i.productId);
      await db
        .update(schema.orderItems)
        .set({
          unitPriceCents: p?.priceCents ?? 0,
          unitCostCents: p?.costCents ?? 0,
          lineCategory: p?.category ?? null,
        })
        .where(eq(schema.orderItems.id, i.id));
    }
  }

  console.log("✅ Backfill completo.");
  await client.end();
}

main().catch((err) => {
  console.error("❌ Backfill failed:", err);
  process.exit(1);
});
