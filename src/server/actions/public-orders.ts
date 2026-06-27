"use server";

import { headers } from "next/headers";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  orders,
  orderItems,
  deliverySlots,
  products,
  paymentMethods,
  volumeDiscounts,
} from "@/db/schema";
import { publicOrderSchema } from "@/lib/validation";
import { sumBowls, evaluateCapacity } from "@/lib/capacity";
import { computeOrderSnapshot } from "@/lib/costing";
import { buildCapacitySnapshot } from "@/server/capacity-service";
import { getSettings } from "@/server/settings";
import { isActiveDeliveryDay } from "@/lib/dates";
import { checkRateLimit, clientIp } from "@/server/rate-limit";
import { type ActionResult, ok, fail } from "@/lib/action-result";

/**
 * Public, unauthenticated self-order. Protected by a honeypot + per-IP rate
 * limit, full server-side validation, and a HARD capacity check (no operator
 * override). Creates a pending order and returns its public token.
 */
export async function createPublicOrder(
  input: unknown,
): Promise<ActionResult<{ token: string; needsVerification: boolean }>> {
  const parsed = publicOrderSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Revisá los datos del formulario.", {
      fieldErrors: parsed.error.flatten().fieldErrors,
    });
  }
  const data = parsed.data;

  // Honeypot: real users never fill this.
  if (data.website && data.website.length > 0) {
    return fail("No se pudo procesar el pedido.");
  }

  // Per-IP rate limit (DB-backed, no external service).
  const ip = clientIp(await headers());
  const okShort = await checkRateLimit(`pub-order:${ip}`, 5, 60);
  const okHour = await checkRateLimit(`pub-order-h:${ip}`, 20, 3600);
  if (!okShort || !okHour) {
    return fail("Demasiados intentos. Esperá un momento e intentá de nuevo.");
  }

  const settings = await getSettings();
  if (!isActiveDeliveryDay(data.deliveryDate, settings.activeDeliveryDays)) {
    return fail("Ese día no está disponible para pedidos.");
  }

  const productIds = data.items.map((i) => i.productId);
  const [slot, foundProducts, payment] = await Promise.all([
    db.query.deliverySlots.findFirst({ where: eq(deliverySlots.id, data.deliverySlotId) }),
    db.query.products.findMany({
      where: and(inArray(products.id, productIds), eq(products.isActive, true)),
    }),
    db.query.paymentMethods.findFirst({
      where: and(eq(paymentMethods.id, data.paymentMethodId), eq(paymentMethods.isActive, true)),
    }),
  ]);

  if (!slot || !slot.isActive) return fail("Ese horario no está disponible.");
  if (foundProducts.length !== new Set(productIds).size) {
    return fail("Uno o más platos ya no están disponibles.");
  }
  if (!payment) return fail("La forma de pago no es válida.");

  const isPickup = data.fulfillmentType === "pickup";
  const totalBowls = sumBowls(data.items);

  // Frozen financial snapshot (same as the admin actions).
  const tiers = await db.query.volumeDiscounts.findMany({
    where: eq(volumeDiscounts.isActive, true),
  });
  const productMap = new Map(foundProducts.map((p) => [p.id, p]));
  const fin = computeOrderSnapshot(
    data.items.map((i) => {
      const p = productMap.get(i.productId)!;
      return {
        product: { priceCents: p.priceCents, costCents: p.costCents, category: p.category },
        quantity: i.quantity,
      };
    }),
    tiers.map((t) => ({
      category: t.category,
      minQuantity: t.minQuantity,
      discountBps: t.discountBps,
      isActive: t.isActive,
    })),
  );

  // Capacity: the HARD ceiling blocks (cannot be saved). Exceeding only the
  // SOFT capacity is allowed but flags the order for operator verification.
  const snapshot = await buildCapacitySnapshot({
    date: data.deliveryDate,
    slotId: data.deliverySlotId,
  });
  const evaluation = evaluateCapacity(snapshot, totalBowls);
  if (evaluation.hardBlocked) {
    return fail("Ese horario ya no tiene lugar. Elegí otro horario o reducí la cantidad.");
  }
  const needsVerification = evaluation.requiresApproval;

  const token = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(orders)
      .values({
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        customerAddress: isPickup ? "" : (data.customerAddress ?? "").trim(),
        fulfillmentType: data.fulfillmentType,
        paymentMethodId: data.paymentMethodId,
        customerNotes: data.customerNotes?.trim() || null,
        deliveryDate: data.deliveryDate,
        deliverySlotId: data.deliverySlotId,
        status: "pending",
        totalBowls,
        subtotalCents: fin.subtotalCents,
        discountCents: fin.discountCents,
        totalCents: fin.totalCents,
        goodsCostCents: fin.goodsCostCents,
        pricedAt: new Date(),
        exceededSlotCapacity: evaluation.exceededSlotCapacity,
        exceededDailyCapacity: evaluation.exceededDailyCapacity,
      })
      .returning({ id: orders.id, token: orders.publicToken });

    await tx.insert(orderItems).values(
      data.items.map((i) => {
        const p = productMap.get(i.productId);
        return {
          orderId: created.id,
          productId: i.productId,
          quantity: i.quantity,
          unitPriceCents: p?.priceCents ?? 0,
          unitCostCents: p?.costCents ?? 0,
          lineCategory: p?.category ?? null,
        };
      }),
    );
    return created.token;
  });

  return ok({ token, needsVerification });
}
