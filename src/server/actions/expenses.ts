"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { expenses } from "@/db/schema";
import { expenseSchema } from "@/lib/validation";
import { type ActionResult, ok, fail } from "@/lib/action-result";
import { requireUser } from "@/lib/auth/session";

function revalidate() {
  revalidatePath("/gastos");
  revalidatePath("/finanzas");
}

export async function createExpense(input: unknown): Promise<ActionResult<{ id: string }>> {
  await requireUser();
  const parsed = expenseSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Datos inválidos.", { fieldErrors: parsed.error.flatten().fieldErrors });
  }
  const [row] = await db
    .insert(expenses)
    .values({
      expenseDate: parsed.data.expenseDate,
      amountCents: parsed.data.amountCents,
      category: parsed.data.category,
      kind: parsed.data.kind,
      vendor: parsed.data.vendor?.trim() || null,
      notes: parsed.data.notes?.trim() || null,
    })
    .returning({ id: expenses.id });
  revalidate();
  return ok({ id: row.id });
}

export async function updateExpense(id: string, input: unknown): Promise<ActionResult> {
  await requireUser();
  const parsed = expenseSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Datos inválidos.", { fieldErrors: parsed.error.flatten().fieldErrors });
  }
  await db
    .update(expenses)
    .set({
      expenseDate: parsed.data.expenseDate,
      amountCents: parsed.data.amountCents,
      category: parsed.data.category,
      kind: parsed.data.kind,
      vendor: parsed.data.vendor?.trim() || null,
      notes: parsed.data.notes?.trim() || null,
    })
    .where(eq(expenses.id, id));
  revalidate();
  return ok(undefined);
}

export async function deleteExpense(id: string): Promise<ActionResult> {
  await requireUser();
  await db.delete(expenses).where(eq(expenses.id, id));
  revalidate();
  return ok(undefined);
}
