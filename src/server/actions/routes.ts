"use server";

import { db } from "@/db";
import { deliveryRuns } from "@/db/schema";
import { revalidatePath } from "next/cache";
import { deliveryRunSchema } from "@/lib/validation";
import { type ActionResult, ok, fail } from "@/lib/action-result";
import { requireUser } from "@/lib/auth/session";

/** Record (or update) the actual shipping cost of a delivery run (date + slot). */
export async function upsertDeliveryRun(input: unknown): Promise<ActionResult> {
  await requireUser();
  const parsed = deliveryRunSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Datos inválidos.", { fieldErrors: parsed.error.flatten().fieldErrors });
  }
  const { deliveryDate, slotId, shippingMethodId, actualCostCents } = parsed.data;
  await db
    .insert(deliveryRuns)
    .values({ deliveryDate, slotId, shippingMethodId: shippingMethodId ?? null, actualCostCents })
    .onConflictDoUpdate({
      target: [deliveryRuns.deliveryDate, deliveryRuns.slotId],
      set: { shippingMethodId: shippingMethodId ?? null, actualCostCents },
    });
  revalidatePath("/routes");
  return ok(undefined);
}
