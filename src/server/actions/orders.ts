"use server";

import { db } from "@/db";
import {
  orders,
  orderItems,
  deliverySlots,
  products,
  paymentMethods,
  shippingMethods,
} from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { createOrderSchema, updateOrderSchema, type OrderInput } from "@/lib/validation";
import { evaluateCapacity, sumBowls } from "@/lib/capacity";
import { buildCapacitySnapshot } from "@/server/capacity-service";
import { canTransition, isValidStatus } from "@/lib/order-status";
import { type ActionResult, ok, fail } from "@/lib/action-result";
import { requireUser } from "@/lib/auth/session";
import type { OrderStatus } from "@/db/schema";

function normalizeNotes(value?: string | null): string | null {
  const v = (value ?? "").trim();
  return v.length ? v : null;
}

/** Validate that the slot, products, and payment/shipping methods exist. */
async function validateReferences(data: OrderInput): Promise<string | null> {
  const productIds = data.items.map((i) => i.productId);
  const [slot, rows, payment, shipping] = await Promise.all([
    db.query.deliverySlots.findFirst({ where: eq(deliverySlots.id, data.deliverySlotId) }),
    db.query.products.findMany({ where: inArray(products.id, productIds) }),
    data.paymentMethodId
      ? db.query.paymentMethods.findFirst({
          where: eq(paymentMethods.id, data.paymentMethodId),
        })
      : Promise.resolve(undefined),
    data.fulfillmentType === "delivery" && data.shippingMethodId
      ? db.query.shippingMethods.findFirst({
          where: eq(shippingMethods.id, data.shippingMethodId),
        })
      : Promise.resolve(undefined),
  ]);
  if (!slot) return "La franja horaria seleccionada no existe.";
  if (rows.length !== new Set(productIds).size) {
    return "Uno o más productos no existen.";
  }
  if (data.paymentMethodId && !payment) return "La forma de pago no existe.";
  if (data.fulfillmentType === "delivery" && data.shippingMethodId && !shipping) {
    return "La forma de envío no existe.";
  }
  return null;
}

/** Pickup orders carry no address/coords/shipping method. */
function fulfillmentFields(data: OrderInput) {
  const isPickup = data.fulfillmentType === "pickup";
  return {
    fulfillmentType: data.fulfillmentType,
    paymentMethodId: data.paymentMethodId ?? null,
    customerAddress: isPickup ? "" : (data.customerAddress ?? "").trim(),
    latitude: isPickup ? null : (data.latitude ?? null),
    longitude: isPickup ? null : (data.longitude ?? null),
    shippingMethodId: isPickup ? null : (data.shippingMethodId ?? null),
  };
}

export async function createOrder(input: unknown): Promise<ActionResult<{ id: string }>> {
  await requireUser();

  const parsed = createOrderSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Revise los datos del formulario.", {
      fieldErrors: parsed.error.flatten().fieldErrors,
    });
  }
  const data = parsed.data;

  const refError = await validateReferences(data);
  if (refError) return fail(refError);

  const totalBowls = sumBowls(data.items);
  const snapshot = await buildCapacitySnapshot({
    date: data.deliveryDate,
    slotId: data.deliverySlotId,
  });
  const evaluation = evaluateCapacity(snapshot, totalBowls);

  if (evaluation.hardBlocked) {
    return fail(
      evaluation.hardWarning ?? "El pedido supera el máximo permitido.",
      { capacity: evaluation },
    );
  }

  if (evaluation.requiresApproval && !data.overCapacityApproved) {
    return fail("Este pedido supera la capacidad. Confirme para continuar.", {
      needsApproval: true,
      capacity: evaluation,
    });
  }

  const newId = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(orders)
      .values({
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        ...fulfillmentFields(data),
        customerNotes: normalizeNotes(data.customerNotes),
        internalNotes: normalizeNotes(data.internalNotes),
        trackingUrl: normalizeNotes(data.trackingUrl),
        deliveryDate: data.deliveryDate,
        deliverySlotId: data.deliverySlotId,
        status: (data.status as OrderStatus) ?? "pending",
        totalBowls,
        exceededSlotCapacity: evaluation.exceededSlotCapacity,
        exceededDailyCapacity: evaluation.exceededDailyCapacity,
        overCapacityApproved: evaluation.requiresApproval,
        overCapacityApprovedAt: evaluation.requiresApproval ? new Date() : null,
      })
      .returning({ id: orders.id });

    await tx.insert(orderItems).values(
      data.items.map((i) => ({
        orderId: created.id,
        productId: i.productId,
        quantity: i.quantity,
      })),
    );
    return created.id;
  });

  revalidatePath("/");
  revalidatePath("/orders");
  return ok({ id: newId }, evaluation);
}

export async function updateOrder(
  id: string,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  await requireUser();

  const existing = await db.query.orders.findFirst({ where: eq(orders.id, id) });
  if (!existing) return fail("El pedido no existe.");

  const parsed = updateOrderSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Revise los datos del formulario.", {
      fieldErrors: parsed.error.flatten().fieldErrors,
    });
  }
  const data = parsed.data;

  const refError = await validateReferences(data);
  if (refError) return fail(refError);

  const totalBowls = sumBowls(data.items);
  // Exclude THIS order from existing totals to avoid double-counting.
  const snapshot = await buildCapacitySnapshot({
    date: data.deliveryDate,
    slotId: data.deliverySlotId,
    excludeOrderId: id,
  });
  const evaluation = evaluateCapacity(snapshot, totalBowls);

  if (evaluation.hardBlocked) {
    return fail(
      evaluation.hardWarning ?? "El pedido supera el máximo permitido.",
      { capacity: evaluation },
    );
  }

  if (evaluation.requiresApproval && !data.overCapacityApproved) {
    return fail("Este pedido supera la capacidad. Confirme para continuar.", {
      needsApproval: true,
      capacity: evaluation,
    });
  }

  const nextStatus = (data.status as OrderStatus) ?? existing.status;
  if (nextStatus !== existing.status && !canTransition(existing.status, nextStatus)) {
    return fail(
      `Transición de estado no permitida: ${existing.status} → ${nextStatus}.`,
    );
  }

  await db.transaction(async (tx) => {
    await tx
      .update(orders)
      .set({
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        ...fulfillmentFields(data),
        customerNotes: normalizeNotes(data.customerNotes),
        internalNotes: normalizeNotes(data.internalNotes),
        trackingUrl: normalizeNotes(data.trackingUrl),
        deliveryDate: data.deliveryDate,
        deliverySlotId: data.deliverySlotId,
        status: nextStatus,
        totalBowls,
        exceededSlotCapacity: evaluation.exceededSlotCapacity,
        exceededDailyCapacity: evaluation.exceededDailyCapacity,
        overCapacityApproved: evaluation.requiresApproval,
        overCapacityApprovedAt: evaluation.requiresApproval
          ? (existing.overCapacityApprovedAt ?? new Date())
          : null,
      })
      .where(eq(orders.id, id));

    // Replace items wholesale (simplest correct approach for a small system).
    await tx.delete(orderItems).where(eq(orderItems.orderId, id));
    await tx.insert(orderItems).values(
      data.items.map((i) => ({
        orderId: id,
        productId: i.productId,
        quantity: i.quantity,
      })),
    );
  });

  revalidatePath("/");
  revalidatePath("/orders");
  revalidatePath(`/orders/${id}/edit`);
  return ok({ id }, evaluation);
}

export async function updateOrderStatus(
  id: string,
  status: string,
): Promise<ActionResult<{ id: string }>> {
  await requireUser();

  if (!isValidStatus(status)) return fail("Estado inválido.");

  const existing = await db.query.orders.findFirst({ where: eq(orders.id, id) });
  if (!existing) return fail("El pedido no existe.");

  if (!canTransition(existing.status, status)) {
    return fail(`Transición no permitida: ${existing.status} → ${status}.`);
  }

  await db.update(orders).set({ status }).where(eq(orders.id, id));

  revalidatePath("/");
  revalidatePath("/orders");
  revalidatePath(`/orders/${id}/edit`);
  return ok({ id });
}

export async function deleteOrder(id: string): Promise<ActionResult<{ id: string }>> {
  await requireUser();
  const existing = await db.query.orders.findFirst({ where: eq(orders.id, id) });
  if (!existing) return fail("El pedido no existe.");

  await db.delete(orders).where(eq(orders.id, id)); // items cascade
  revalidatePath("/");
  revalidatePath("/orders");
  return ok({ id });
}

/** Nice-to-have: duplicate an order as a new pending order. */
export async function duplicateOrder(id: string): Promise<ActionResult<{ id: string }>> {
  await requireUser();
  const source = await db.query.orders.findFirst({
    where: eq(orders.id, id),
    with: { items: true },
  });
  if (!source) return fail("El pedido no existe.");

  const newId = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(orders)
      .values({
        customerName: source.customerName,
        customerPhone: source.customerPhone,
        customerAddress: source.customerAddress,
        latitude: source.latitude,
        longitude: source.longitude,
        fulfillmentType: source.fulfillmentType,
        paymentMethodId: source.paymentMethodId,
        shippingMethodId: source.shippingMethodId,
        customerNotes: source.customerNotes,
        internalNotes: source.internalNotes,
        trackingUrl: source.trackingUrl,
        deliveryDate: source.deliveryDate,
        deliverySlotId: source.deliverySlotId,
        status: "pending",
        totalBowls: source.totalBowls,
        exceededSlotCapacity: false,
        exceededDailyCapacity: false,
        overCapacityApproved: false,
      })
      .returning({ id: orders.id });

    if (source.items.length) {
      await tx.insert(orderItems).values(
        source.items.map((i) => ({
          orderId: created.id,
          productId: i.productId,
          quantity: i.quantity,
        })),
      );
    }
    return created.id;
  });

  revalidatePath("/orders");
  return ok({ id: newId });
}
