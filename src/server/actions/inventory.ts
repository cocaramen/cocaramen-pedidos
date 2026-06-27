"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { ingredients, recipeItems, purchases, purchaseItems, stockMovements } from "@/db/schema";
import {
  ingredientSchema,
  recipeItemSchema,
  purchaseSchema,
  stockAdjustmentSchema,
} from "@/lib/validation";
import { type ActionResult, ok, fail } from "@/lib/action-result";
import { requireUser } from "@/lib/auth/session";
import { recomputeCostsForIngredient, recomputeProductCost } from "@/server/inventory-service";

function revalidate() {
  revalidatePath("/inventario");
  revalidatePath("/finanzas");
  revalidatePath("/settings");
}

// ── Ingredients ────────────────────────────────────────────────
export async function createIngredient(input: unknown): Promise<ActionResult<{ id: string }>> {
  await requireUser();
  const parsed = ingredientSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Datos inválidos.", { fieldErrors: parsed.error.flatten().fieldErrors });
  }
  try {
    const [row] = await db.insert(ingredients).values(parsed.data).returning({ id: ingredients.id });
    revalidate();
    return ok({ id: row.id });
  } catch {
    return fail("Ya existe un insumo con ese nombre.");
  }
}

export async function updateIngredient(id: string, input: unknown): Promise<ActionResult> {
  await requireUser();
  const parsed = ingredientSchema.partial().safeParse(input);
  if (!parsed.success) {
    return fail("Datos inválidos.", { fieldErrors: parsed.error.flatten().fieldErrors });
  }
  await db.update(ingredients).set(parsed.data).where(eq(ingredients.id, id));
  revalidate();
  return ok(undefined);
}

export async function setIngredientActive(id: string, isActive: boolean): Promise<ActionResult> {
  await requireUser();
  await db.update(ingredients).set({ isActive }).where(eq(ingredients.id, id));
  revalidate();
  return ok(undefined);
}

/** Physical stock count → records an adjustment movement and sets the new stock. */
export async function adjustStock(input: unknown): Promise<ActionResult> {
  await requireUser();
  const parsed = stockAdjustmentSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Datos inválidos.", { fieldErrors: parsed.error.flatten().fieldErrors });
  }
  const { ingredientId, countedBase, reason } = parsed.data;
  const ing = await db.query.ingredients.findFirst({ where: eq(ingredients.id, ingredientId) });
  if (!ing) return fail("El insumo no existe.");
  const delta = countedBase - ing.stockBase;
  if (delta !== 0) {
    await db.insert(stockMovements).values({
      ingredientId,
      qtyBase: delta,
      kind: "adjustment",
      unitCostCents: ing.avgCostCents,
      reason: reason?.trim() || "Ajuste por conteo",
    });
    await db.update(ingredients).set({ stockBase: countedBase }).where(eq(ingredients.id, ingredientId));
  }
  revalidate();
  return ok(undefined);
}

// ── Recipes (BOM) ──────────────────────────────────────────────
export async function setRecipeItem(input: unknown): Promise<ActionResult> {
  await requireUser();
  const parsed = recipeItemSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Datos inválidos.", { fieldErrors: parsed.error.flatten().fieldErrors });
  }
  await db
    .insert(recipeItems)
    .values(parsed.data)
    .onConflictDoUpdate({
      target: [recipeItems.productId, recipeItems.ingredientId],
      set: { qtyPerUnitBase: parsed.data.qtyPerUnitBase },
    });
  await recomputeProductCost(db, parsed.data.productId);
  revalidate();
  return ok(undefined);
}

export async function deleteRecipeItem(id: string): Promise<ActionResult> {
  await requireUser();
  const item = await db.query.recipeItems.findFirst({ where: eq(recipeItems.id, id) });
  if (!item) return ok(undefined);
  await db.delete(recipeItems).where(eq(recipeItems.id, id));
  await recomputeProductCost(db, item.productId);
  revalidate();
  return ok(undefined);
}

// ── Purchases (cash-out + stock entry + WAC) ───────────────────
export async function createPurchase(input: unknown): Promise<ActionResult<{ id: string }>> {
  await requireUser();
  const parsed = purchaseSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Datos inválidos.", { fieldErrors: parsed.error.flatten().fieldErrors });
  }
  const data = parsed.data;
  const totalCents = data.items.reduce((s, i) => s + i.qtyBase * i.unitCostCents, 0);

  const id = await db.transaction(async (tx) => {
    const [purchase] = await tx
      .insert(purchases)
      .values({
        purchaseDate: data.purchaseDate,
        vendor: data.vendor?.trim() || null,
        notes: data.notes?.trim() || null,
        totalCents,
      })
      .returning({ id: purchases.id });

    const touched = new Set<string>();
    for (const item of data.items) {
      const ing = await tx.query.ingredients.findFirst({
        where: eq(ingredients.id, item.ingredientId),
      });
      if (!ing) continue;
      const newStock = ing.stockBase + item.qtyBase;
      const newWac =
        newStock > 0
          ? Math.round((ing.stockBase * ing.avgCostCents + item.qtyBase * item.unitCostCents) / newStock)
          : item.unitCostCents;

      await tx.insert(purchaseItems).values({
        purchaseId: purchase.id,
        ingredientId: item.ingredientId,
        qtyBase: item.qtyBase,
        unitCostCents: item.unitCostCents,
      });
      await tx.insert(stockMovements).values({
        ingredientId: item.ingredientId,
        qtyBase: item.qtyBase,
        kind: "purchase",
        unitCostCents: item.unitCostCents,
        refTable: "purchases",
        refId: purchase.id,
      });
      await tx
        .update(ingredients)
        .set({ stockBase: newStock, avgCostCents: newWac })
        .where(eq(ingredients.id, item.ingredientId));
      touched.add(item.ingredientId);
    }
    // Recipe-derived product costs change when WAC changes.
    for (const ingId of touched) await recomputeCostsForIngredient(tx, ingId);
    return purchase.id;
  });

  revalidate();
  return ok({ id });
}

export async function deletePurchase(id: string): Promise<ActionResult> {
  await requireUser();
  // Reverse the stock entries this purchase created, then remove it.
  await db.transaction(async (tx) => {
    const items = await tx.query.purchaseItems.findMany({
      where: eq(purchaseItems.purchaseId, id),
    });
    const touched = new Set<string>();
    for (const item of items) {
      await tx
        .update(ingredients)
        .set({ stockBase: sql`${ingredients.stockBase} - ${item.qtyBase}` })
        .where(eq(ingredients.id, item.ingredientId));
      touched.add(item.ingredientId);
    }
    await tx
      .delete(stockMovements)
      .where(and(eq(stockMovements.refTable, "purchases"), eq(stockMovements.refId, id)));
    await tx.delete(purchases).where(eq(purchases.id, id)); // items cascade
    for (const ingId of touched) await recomputeCostsForIngredient(tx, ingId);
  });
  revalidate();
  return ok(undefined);
}
