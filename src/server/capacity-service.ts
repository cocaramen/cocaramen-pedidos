import "server-only";
import { db } from "@/db";
import { orders, orderItems, deliverySlots } from "@/db/schema";
import { and, eq, ne, sql } from "drizzle-orm";
import type { CapacitySnapshot } from "@/lib/capacity";
import { getSettings } from "./settings";

/**
 * Cancelled orders never consume capacity.
 */
const COUNTS_TOWARD_CAPACITY = sql`${orders.status} <> 'cancelled'`;

/**
 * Total bowls booked on a given date (optionally for a single slot),
 * excluding cancelled orders and optionally excluding one order (the one
 * being edited, to avoid double-counting).
 */
async function bowlsForDate(opts: {
  date: string;
  slotId?: string;
  excludeOrderId?: string;
}): Promise<number> {
  const conditions = [eq(orders.deliveryDate, opts.date), COUNTS_TOWARD_CAPACITY];
  if (opts.slotId) conditions.push(eq(orders.deliverySlotId, opts.slotId));
  if (opts.excludeOrderId) conditions.push(ne(orders.id, opts.excludeOrderId));

  const [row] = await db
    .select({ total: sql<number>`coalesce(sum(${orderItems.quantity}), 0)::int` })
    .from(orders)
    .innerJoin(orderItems, eq(orderItems.orderId, orders.id))
    .where(and(...conditions));

  return row?.total ?? 0;
}

/**
 * Build the capacity snapshot needed to evaluate a new/edited order.
 * `excludeOrderId` removes the order being edited from the existing totals.
 */
export async function buildCapacitySnapshot(opts: {
  date: string;
  slotId: string;
  excludeOrderId?: string;
}): Promise<CapacitySnapshot> {
  const [settingsData, slot, slotBowls, dailyBowls] = await Promise.all([
    getSettings(),
    db.query.deliverySlots.findFirst({ where: eq(deliverySlots.id, opts.slotId) }),
    bowlsForDate({ date: opts.date, slotId: opts.slotId, excludeOrderId: opts.excludeOrderId }),
    bowlsForDate({ date: opts.date, excludeOrderId: opts.excludeOrderId }),
  ]);

  return {
    slotBowls,
    dailyBowls,
    slotCapacity: slot?.capacityLimit ?? settingsData.defaultSlotCapacity,
    dailyCapacity: settingsData.defaultDailyCapacity,
    slotMaxCapacity: settingsData.maxSlotCapacity,
    dailyMaxCapacity: settingsData.maxDailyCapacity,
  };
}
