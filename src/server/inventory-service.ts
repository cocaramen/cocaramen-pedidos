import "server-only";
import { db } from "@/db";
import { products, recipeItems, ingredients, stockMovements } from "@/db/schema";
import { and, eq, inArray, sql } from "drizzle-orm";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type DbOrTx = typeof db | Tx;

/**
 * Recompute a product's costCents from its recipe (Σ qty/unit × ingredient WAC).
 * Only products WITH a recipe are touched — manual costCents stays otherwise.
 */
export async function recomputeProductCost(tx: DbOrTx, productId: string): Promise<void> {
  const rows = await tx
    .select({
      qty: recipeItems.qtyPerUnitBase,
      avg: ingredients.avgCostCents,
    })
    .from(recipeItems)
    .innerJoin(ingredients, eq(ingredients.id, recipeItems.ingredientId))
    .where(eq(recipeItems.productId, productId));

  if (rows.length === 0) return; // no recipe → keep manual cost
  const cost = rows.reduce((sum, r) => sum + r.qty * r.avg, 0);
  await tx.update(products).set({ costCents: cost }).where(eq(products.id, productId));
}

/** Recompute costs of every product whose recipe uses this ingredient. */
export async function recomputeCostsForIngredient(tx: DbOrTx, ingredientId: string): Promise<void> {
  const rows = await tx
    .selectDistinct({ productId: recipeItems.productId })
    .from(recipeItems)
    .where(eq(recipeItems.ingredientId, ingredientId));
  for (const r of rows) await recomputeProductCost(tx, r.productId);
}

/** Net base units currently consumed by an order, per ingredient (negative = consumed). */
async function netConsumedByIngredient(
  tx: DbOrTx,
  orderId: string,
): Promise<Map<string, number>> {
  const rows = await tx
    .select({
      ingredientId: stockMovements.ingredientId,
      net: sql<number>`coalesce(sum(${stockMovements.qtyBase}), 0)::int`,
      cost: sql<number>`max(${stockMovements.unitCostCents})::int`,
    })
    .from(stockMovements)
    .where(
      and(
        eq(stockMovements.refTable, "orders"),
        eq(stockMovements.refId, orderId),
        inArray(stockMovements.kind, ["consumption", "consumption_reversal"]),
      ),
    )
    .groupBy(stockMovements.ingredientId);
  return new Map(rows.map((r) => [r.ingredientId, r.net]));
}

/**
 * Deplete inventory for a delivered order, per recipe. Idempotent: if the order
 * is already actively consumed, does nothing. Never blocks (stock can go negative).
 */
export async function consumeForOrder(orderId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const net = await netConsumedByIngredient(tx, orderId);
    const alreadyConsumed = [...net.values()].some((v) => v < 0);
    if (alreadyConsumed) return;

    // Order lines.
    const lines = await tx.query.orderItems.findMany({
      where: (oi, { eq: e }) => e(oi.orderId, orderId),
    });
    if (lines.length === 0) return;

    // Recipes for the products in this order.
    const productIds = [...new Set(lines.map((l) => l.productId))];
    const recipe = await tx
      .select({
        productId: recipeItems.productId,
        ingredientId: recipeItems.ingredientId,
        qty: recipeItems.qtyPerUnitBase,
      })
      .from(recipeItems)
      .where(inArray(recipeItems.productId, productIds));
    if (recipe.length === 0) return; // no recipes → nothing to deplete

    // Aggregate required base units per ingredient.
    const need = new Map<string, number>();
    for (const line of lines) {
      for (const r of recipe) {
        if (r.productId !== line.productId) continue;
        need.set(r.ingredientId, (need.get(r.ingredientId) ?? 0) + r.qty * line.quantity);
      }
    }
    if (need.size === 0) return;

    const ings = await tx
      .select()
      .from(ingredients)
      .where(inArray(ingredients.id, [...need.keys()]));
    const costMap = new Map(ings.map((i) => [i.id, i.avgCostCents]));

    for (const [ingredientId, qty] of need) {
      await tx.insert(stockMovements).values({
        ingredientId,
        qtyBase: -qty,
        kind: "consumption",
        unitCostCents: costMap.get(ingredientId) ?? 0,
        refTable: "orders",
        refId: orderId,
      });
      await tx
        .update(ingredients)
        .set({ stockBase: sql`${ingredients.stockBase} - ${qty}` })
        .where(eq(ingredients.id, ingredientId));
    }
  });
}

/** Reverse a previously-consumed order (e.g. delivered → cancelled). Idempotent. */
export async function reverseConsumptionForOrder(orderId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const movements = await tx
      .select()
      .from(stockMovements)
      .where(
        and(
          eq(stockMovements.refTable, "orders"),
          eq(stockMovements.refId, orderId),
          inArray(stockMovements.kind, ["consumption", "consumption_reversal"]),
        ),
      );
    // Net per ingredient: negative = still consumed → restore that amount.
    const net = new Map<string, { qty: number; cost: number }>();
    for (const m of movements) {
      const cur = net.get(m.ingredientId) ?? { qty: 0, cost: m.unitCostCents };
      cur.qty += m.qtyBase;
      net.set(m.ingredientId, cur);
    }
    for (const [ingredientId, { qty, cost }] of net) {
      if (qty >= 0) continue; // not consumed / already reversed
      const restore = -qty; // positive
      await tx.insert(stockMovements).values({
        ingredientId,
        qtyBase: restore,
        kind: "consumption_reversal",
        unitCostCents: cost,
        refTable: "orders",
        refId: orderId,
      });
      await tx
        .update(ingredients)
        .set({ stockBase: sql`${ingredients.stockBase} + ${restore}` })
        .where(eq(ingredients.id, ingredientId));
    }
  });
}

/** Apply a status change's inventory side-effect (deplete on delivered, reverse off it). */
export async function applyInventoryForStatusChange(
  orderId: string,
  from: string,
  to: string,
): Promise<void> {
  if (to === "delivered" && from !== "delivered") {
    await consumeForOrder(orderId);
  } else if (from === "delivered" && to !== "delivered") {
    await reverseConsumptionForOrder(orderId);
  }
}
