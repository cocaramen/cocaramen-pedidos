"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { receiptImageSchema } from "@/lib/validation";
import { type ActionResult, ok, fail } from "@/lib/action-result";
import { requireUser } from "@/lib/auth/session";
import {
  storageConfigured,
  uploadPrivateImage,
  removeFromBucket,
  parseDataUri,
} from "@/lib/supabase/storage";

const RECEIPT_BUCKET = "comprobantes";
const isDataUri = (s: string) => s.startsWith("data:");

/** Attach (or replace) a transfer-payment receipt on an order. Admin only. */
export async function uploadTransferReceipt(
  orderId: string,
  input: unknown,
): Promise<ActionResult> {
  await requireUser();
  const parsed = receiptImageSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Imagen inválida.", { fieldErrors: parsed.error.flatten().fieldErrors });
  }

  const order = await db.query.orders.findFirst({ where: eq(orders.id, orderId) });
  if (!order) return fail("El pedido no existe.");
  const prev = order.transferReceiptPath;

  let value = parsed.data.image; // data URI fallback when Storage is off
  if (storageConfigured()) {
    try {
      const img = parseDataUri(parsed.data.image);
      if (img) {
        const ext = img.contentType.split("/")[1] || "webp";
        const path = `${orderId}-${Date.now()}.${ext}`;
        await uploadPrivateImage({
          bucket: RECEIPT_BUCKET,
          path,
          bytes: img.bytes,
          contentType: img.contentType,
        });
        value = path;
      }
    } catch {
      value = parsed.data.image;
    }
  }

  await db.update(orders).set({ transferReceiptPath: value }).where(eq(orders.id, orderId));

  if (prev && prev !== value && !isDataUri(prev)) {
    await removeFromBucket(RECEIPT_BUCKET, prev);
  }

  revalidatePath(`/orders/${orderId}/edit`);
  return ok(undefined);
}

export async function clearTransferReceipt(orderId: string): Promise<ActionResult> {
  await requireUser();
  const order = await db.query.orders.findFirst({ where: eq(orders.id, orderId) });
  if (!order) return fail("El pedido no existe.");
  const prev = order.transferReceiptPath;

  await db.update(orders).set({ transferReceiptPath: null }).where(eq(orders.id, orderId));
  if (prev && !isDataUri(prev)) await removeFromBucket(RECEIPT_BUCKET, prev);

  revalidatePath(`/orders/${orderId}/edit`);
  return ok(undefined);
}
