"use server";

import { db } from "@/db";
import { orders, orderItems, deliverySlots, brothTypes } from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { createOrderSchema, updateOrderSchema } from "@/lib/validation";
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

/** Validate that referenced slot + broth types exist and are usable. */
async function validateReferences(
  slotId: string,
  brothTypeIds: string[],
): Promise<string | null> {
  const [slot, broths] = await Promise.all([
    db.query.deliverySlots.findFirst({ where: eq(deliverySlots.id, slotId) }),
    db.query.brothTypes.findMany({ where: inArray(brothTypes.id, brothTypeIds) }),
  ]);
  if (!slot) return "La franja horaria seleccionada no existe.";
  if (broths.length !== new Set(brothTypeIds).size) {
    return "Uno o más tipos de caldo no existen.";
  }
  return null;
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

  const refError = await validateReferences(
    data.deliverySlotId,
    data.items.map((i) => i.brothTypeId),
  );
  if (refError) return fail(refError);

  const totalBowls = sumBowls(data.items);
  const snapshot = await buildCapacitySnapshot({
    date: data.deliveryDate,
    slotId: data.deliverySlotId,
  });
  const evaluation = evaluateCapacity(snapshot, totalBowls);

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
        customerAddress: data.customerAddress,
        customerNotes: normalizeNotes(data.customerNotes),
        internalNotes: normalizeNotes(data.internalNotes),
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
        brothTypeId: i.brothTypeId,
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

  const refError = await validateReferences(
    data.deliverySlotId,
    data.items.map((i) => i.brothTypeId),
  );
  if (refError) return fail(refError);

  const totalBowls = sumBowls(data.items);
  // Exclude THIS order from existing totals to avoid double-counting.
  const snapshot = await buildCapacitySnapshot({
    date: data.deliveryDate,
    slotId: data.deliverySlotId,
    excludeOrderId: id,
  });
  const evaluation = evaluateCapacity(snapshot, totalBowls);

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
        customerAddress: data.customerAddress,
        customerNotes: normalizeNotes(data.customerNotes),
        internalNotes: normalizeNotes(data.internalNotes),
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
        brothTypeId: i.brothTypeId,
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
        customerNotes: source.customerNotes,
        internalNotes: source.internalNotes,
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
          brothTypeId: i.brothTypeId,
          quantity: i.quantity,
        })),
      );
    }
    return created.id;
  });

  revalidatePath("/orders");
  return ok({ id: newId });
}
