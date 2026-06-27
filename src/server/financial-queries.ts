import "server-only";
import { and, eq, isNotNull, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { orders, orderItems, products, deliveryRuns, expenses } from "@/db/schema";

const AR_TZ = "America/Argentina/Buenos_Aires";

export type Granularity = "day" | "week" | "month" | "year";
const GRANULARITIES: Granularity[] = ["day", "week", "month", "year"];
export function isGranularity(v: string): v is Granularity {
  return (GRANULARITIES as string[]).includes(v);
}

export interface ProfitBucket {
  bucket: string; // YYYY-MM-DD (period start)
  revenueCents: number;
  cogsCents: number;
  deliveryCostCents: number;
  expensesCents: number;
  netCents: number;
}

export interface ProfitSummary {
  revenueCents: number;
  cogsCents: number;
  grossCents: number;
  deliveryCostCents: number;
  expensesCents: number;
  netCents: number;
  paidOrders: number;
  /** Sales already entered but not yet marked paid (not counted as revenue). */
  unpaidRevenueCents: number;
}

export interface ProfitReport {
  summary: ProfitSummary;
  periods: ProfitBucket[];
}

// Revenue is recognized when PAID (paid_at), interpreted in Argentina time.
const paidDateAr = sql`(${orders.paidAt} AT TIME ZONE ${AR_TZ})::date`;

/** Full profit report for a date range (inclusive), grouped by `granularity`. */
export async function getProfit(
  from: string,
  to: string,
  granularity: Granularity,
): Promise<ProfitReport> {
  const g = granularity;

  const [rev] = await db
    .select({
      revenue: sql<number>`coalesce(sum(${orders.totalCents}), 0)::int`,
      cogs: sql<number>`coalesce(sum(${orders.goodsCostCents}), 0)::int`,
      count: sql<number>`count(*)::int`,
    })
    .from(orders)
    .where(
      and(isNotNull(orders.paidAt), ne(orders.status, "cancelled"), sql`${paidDateAr} between ${from} and ${to}`),
    );

  const [unpaid] = await db
    .select({
      revenue: sql<number>`coalesce(sum(${orders.totalCents}), 0)::int`,
    })
    .from(orders)
    .where(
      and(
        sql`${orders.paidAt} is null`,
        ne(orders.status, "cancelled"),
        sql`${orders.deliveryDate} between ${from} and ${to}`,
      ),
    );

  const [del] = await db
    .select({ cost: sql<number>`coalesce(sum(${deliveryRuns.actualCostCents}), 0)::int` })
    .from(deliveryRuns)
    .where(sql`${deliveryRuns.deliveryDate} between ${from} and ${to}`);

  const [exp] = await db
    .select({ total: sql<number>`coalesce(sum(${expenses.amountCents}), 0)::int` })
    .from(expenses)
    .where(sql`${expenses.expenseDate} between ${from} and ${to}`);

  // ── Per-period buckets (three grouped queries merged by bucket) ──
  const revByPeriod = await db
    .select({
      bucket: sql<string>`to_char(date_trunc(${g}, (${orders.paidAt} AT TIME ZONE ${AR_TZ})), 'YYYY-MM-DD')`,
      revenue: sql<number>`coalesce(sum(${orders.totalCents}), 0)::int`,
      cogs: sql<number>`coalesce(sum(${orders.goodsCostCents}), 0)::int`,
    })
    .from(orders)
    .where(
      and(isNotNull(orders.paidAt), ne(orders.status, "cancelled"), sql`${paidDateAr} between ${from} and ${to}`),
    )
    .groupBy(sql`1`);

  const delByPeriod = await db
    .select({
      bucket: sql<string>`to_char(date_trunc(${g}, ${deliveryRuns.deliveryDate}::timestamp), 'YYYY-MM-DD')`,
      cost: sql<number>`coalesce(sum(${deliveryRuns.actualCostCents}), 0)::int`,
    })
    .from(deliveryRuns)
    .where(sql`${deliveryRuns.deliveryDate} between ${from} and ${to}`)
    .groupBy(sql`1`);

  const expByPeriod = await db
    .select({
      bucket: sql<string>`to_char(date_trunc(${g}, ${expenses.expenseDate}::timestamp), 'YYYY-MM-DD')`,
      total: sql<number>`coalesce(sum(${expenses.amountCents}), 0)::int`,
    })
    .from(expenses)
    .where(sql`${expenses.expenseDate} between ${from} and ${to}`)
    .groupBy(sql`1`);

  const map = new Map<string, ProfitBucket>();
  const bucket = (b: string): ProfitBucket => {
    let x = map.get(b);
    if (!x) {
      x = { bucket: b, revenueCents: 0, cogsCents: 0, deliveryCostCents: 0, expensesCents: 0, netCents: 0 };
      map.set(b, x);
    }
    return x;
  };
  for (const r of revByPeriod) {
    const x = bucket(r.bucket);
    x.revenueCents += r.revenue;
    x.cogsCents += r.cogs;
  }
  for (const d of delByPeriod) bucket(d.bucket).deliveryCostCents += d.cost;
  for (const e of expByPeriod) bucket(e.bucket).expensesCents += e.total;
  const periods = [...map.values()]
    .map((p) => ({ ...p, netCents: p.revenueCents - p.cogsCents - p.deliveryCostCents - p.expensesCents }))
    .sort((a, b) => a.bucket.localeCompare(b.bucket));

  const revenueCents = rev?.revenue ?? 0;
  const cogsCents = rev?.cogs ?? 0;
  const deliveryCostCents = del?.cost ?? 0;
  const expensesCents = exp?.total ?? 0;
  return {
    summary: {
      revenueCents,
      cogsCents,
      grossCents: revenueCents - cogsCents,
      deliveryCostCents,
      expensesCents,
      netCents: revenueCents - cogsCents - deliveryCostCents - expensesCents,
      paidOrders: rev?.count ?? 0,
      unpaidRevenueCents: unpaid?.revenue ?? 0,
    },
    periods,
  };
}

/** Margin per product over a range (paid orders only). */
export async function getMarginByProduct(from: string, to: string) {
  return db
    .select({
      productId: orderItems.productId,
      name: products.name,
      qty: sql<number>`coalesce(sum(${orderItems.quantity}), 0)::int`,
      revenue: sql<number>`coalesce(sum(${orderItems.unitPriceCents} * ${orderItems.quantity}), 0)::int`,
      cost: sql<number>`coalesce(sum(${orderItems.unitCostCents} * ${orderItems.quantity}), 0)::int`,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .innerJoin(products, eq(products.id, orderItems.productId))
    .where(
      and(isNotNull(orders.paidAt), ne(orders.status, "cancelled"), sql`${paidDateAr} between ${from} and ${to}`),
    )
    .groupBy(orderItems.productId, products.name)
    .orderBy(sql`3 desc`);
}
