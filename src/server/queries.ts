import "server-only";
import { db } from "@/db";
import {
  orders,
  orderItems,
  deliverySlots,
  products,
  volumeDiscounts,
  messageTemplates,
  paymentMethods,
  shippingMethods,
  deliveryRuns,
} from "@/db/schema";
import { and, asc, desc, eq, ilike, inArray, ne, or, sql, type SQL } from "drizzle-orm";
import { getSettings } from "./settings";
import { DEFAULT_TEMPLATES } from "@/lib/messages";
import type { OrderStatus } from "@/db/schema";

/** Saved message templates merged over the built-in defaults (per status). */
export async function getMessageTemplates(): Promise<Record<OrderStatus, string>> {
  const rows = await db.query.messageTemplates.findMany();
  const map: Record<OrderStatus, string> = { ...DEFAULT_TEMPLATES };
  for (const r of rows) map[r.status] = r.body;
  return map;
}

// ── Reference data ─────────────────────────────────────────────
export async function getActiveProducts() {
  return db.query.products.findMany({
    where: eq(products.isActive, true),
    orderBy: [asc(products.sortOrder), asc(products.name)],
  });
}

export async function getAllProducts() {
  return db.query.products.findMany({
    orderBy: [asc(products.sortOrder), asc(products.name)],
  });
}

export async function getActiveVolumeDiscounts() {
  return db.query.volumeDiscounts.findMany({
    where: eq(volumeDiscounts.isActive, true),
    orderBy: [asc(volumeDiscounts.category), asc(volumeDiscounts.minQuantity)],
  });
}

export async function getAllVolumeDiscounts() {
  return db.query.volumeDiscounts.findMany({
    orderBy: [asc(volumeDiscounts.category), asc(volumeDiscounts.minQuantity)],
  });
}

export async function getActivePaymentMethods() {
  return db.query.paymentMethods.findMany({
    where: eq(paymentMethods.isActive, true),
    orderBy: [asc(paymentMethods.sortOrder), asc(paymentMethods.name)],
  });
}

export async function getAllPaymentMethods() {
  return db.query.paymentMethods.findMany({
    orderBy: [asc(paymentMethods.sortOrder), asc(paymentMethods.name)],
  });
}

export async function getActiveShippingMethods() {
  return db.query.shippingMethods.findMany({
    where: eq(shippingMethods.isActive, true),
    orderBy: [asc(shippingMethods.sortOrder), asc(shippingMethods.name)],
  });
}

export async function getAllShippingMethods() {
  return db.query.shippingMethods.findMany({
    orderBy: [asc(shippingMethods.sortOrder), asc(shippingMethods.name)],
  });
}

export async function getActiveSlots() {
  return db.query.deliverySlots.findMany({
    where: eq(deliverySlots.isActive, true),
    orderBy: [asc(deliverySlots.sortOrder), asc(deliverySlots.startTime)],
  });
}

export async function getAllSlots() {
  return db.query.deliverySlots.findMany({
    orderBy: [asc(deliverySlots.sortOrder), asc(deliverySlots.startTime)],
  });
}

// ── Single order (with items + slot) ───────────────────────────
export async function getOrderById(id: string) {
  return db.query.orders.findFirst({
    where: eq(orders.id, id),
    with: {
      slot: true,
      paymentMethod: true,
      shippingMethod: true,
      items: { with: { product: true } },
    },
  });
}

// ── Public order page (no auth) ────────────────────────────────
export async function getOrderByPublicToken(token: string) {
  return db.query.orders.findFirst({
    where: eq(orders.publicToken, token),
    with: {
      slot: true,
      paymentMethod: true,
      shippingMethod: true,
      items: { with: { product: true } },
    },
  });
}

// ── Orders list with filters ───────────────────────────────────
export interface OrderListFilters {
  search?: string;
  date?: string;
  slotId?: string;
  status?: OrderStatus;
  sort?: "date_desc" | "date_asc" | "created_desc" | "bowls_desc";
}

export async function listOrders(filters: OrderListFilters) {
  const conditions: SQL[] = [];

  if (filters.search) {
    const term = `%${filters.search}%`;
    const clause = or(
      ilike(orders.customerName, term),
      ilike(orders.customerAddress, term),
      ilike(orders.customerPhone, term),
    );
    if (clause) conditions.push(clause);
  }
  if (filters.date) conditions.push(eq(orders.deliveryDate, filters.date));
  if (filters.slotId) conditions.push(eq(orders.deliverySlotId, filters.slotId));
  if (filters.status) conditions.push(eq(orders.status, filters.status));

  const orderBy =
    filters.sort === "date_asc"
      ? [asc(orders.deliveryDate), asc(orders.createdAt)]
      : filters.sort === "created_desc"
        ? [desc(orders.createdAt)]
        : filters.sort === "bowls_desc"
          ? [desc(orders.totalBowls)]
          : [desc(orders.deliveryDate), desc(orders.createdAt)];

  return db.query.orders.findMany({
    where: conditions.length ? and(...conditions) : undefined,
    orderBy,
    with: {
      slot: true,
      items: { with: { product: true } },
    },
    limit: 500,
  });
}

/** Recorded actual shipping costs for a date + set of slots. */
export async function getDeliveryRuns(date: string, slotIds: string[]) {
  if (!slotIds.length) return [];
  return db.query.deliveryRuns.findMany({
    where: and(
      eq(deliveryRuns.deliveryDate, date),
      inArray(deliveryRuns.slotId, slotIds),
    ),
  });
}

// ── Routing ────────────────────────────────────────────────────
/** Statuses that still need to be delivered (so they belong on a route). */
const ROUTABLE_STATUSES: OrderStatus[] = [
  "pending",
  "confirmed",
  "preparing",
  "out_for_delivery",
];

/** Orders for a date + slot set that still need delivery (incl. those without coords). */
export async function getOrdersForRouting(date: string, slotIds: string[]) {
  const conditions: SQL[] = [
    eq(orders.deliveryDate, date),
    inArray(orders.status, ROUTABLE_STATUSES),
    // Pickup orders are collected at the shop — never part of a delivery route.
    eq(orders.fulfillmentType, "delivery"),
  ];
  if (slotIds.length) {
    const clause = inArray(orders.deliverySlotId, slotIds);
    if (clause) conditions.push(clause);
  }
  return db.query.orders.findMany({
    where: and(...conditions),
    with: { slot: true },
    orderBy: [asc(orders.createdAt)],
  });
}

// ── Dashboard ──────────────────────────────────────────────────
export interface SlotUtilization {
  slotId: string;
  label: string;
  capacity: number;
  bowls: number;
  orderCount: number;
  exceeded: boolean;
}

export interface DashboardData {
  date: string;
  dailyBowls: number;
  dailyCapacity: number;
  dailyRemaining: number;
  dailyExceeded: boolean;
  orderCount: number;
  overCapacityOrders: number;
  slots: SlotUtilization[];
  orders: Awaited<ReturnType<typeof listOrders>>;
  statusCounts: Record<string, number>;
}

export async function getDashboardData(date: string): Promise<DashboardData> {
  const [settingsData, slots, dayOrders] = await Promise.all([
    getSettings(),
    getActiveSlots(),
    listOrders({ date, sort: "date_asc" }),
  ]);

  const active = dayOrders.filter((o) => o.status !== "cancelled");

  const bowlsBySlot = new Map<string, number>();
  const countBySlot = new Map<string, number>();
  const statusCounts: Record<string, number> = {};
  let dailyBowls = 0;
  let overCapacityOrders = 0;

  for (const o of dayOrders) {
    statusCounts[o.status] = (statusCounts[o.status] ?? 0) + 1;
    if (o.overCapacityApproved) overCapacityOrders++;
  }
  for (const o of active) {
    dailyBowls += o.totalBowls;
    bowlsBySlot.set(o.deliverySlotId, (bowlsBySlot.get(o.deliverySlotId) ?? 0) + o.totalBowls);
    countBySlot.set(o.deliverySlotId, (countBySlot.get(o.deliverySlotId) ?? 0) + 1);
  }

  const slotUtil: SlotUtilization[] = slots.map((s) => {
    const bowls = bowlsBySlot.get(s.id) ?? 0;
    return {
      slotId: s.id,
      label: s.label,
      capacity: s.capacityLimit,
      bowls,
      orderCount: countBySlot.get(s.id) ?? 0,
      exceeded: bowls > s.capacityLimit,
    };
  });

  return {
    date,
    dailyBowls,
    dailyCapacity: settingsData.defaultDailyCapacity,
    dailyRemaining: settingsData.defaultDailyCapacity - dailyBowls,
    dailyExceeded: dailyBowls > settingsData.defaultDailyCapacity,
    orderCount: dayOrders.length,
    overCapacityOrders,
    slots: slotUtil,
    orders: dayOrders,
    statusCounts,
  };
}

export type OrderWithRelations = Awaited<ReturnType<typeof getOrderById>>;
export type OrderListItem = Awaited<ReturnType<typeof listOrders>>[number];
