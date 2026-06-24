import type { OrderStatus } from "@/db/schema";

export const ORDER_STATUSES: OrderStatus[] = [
  "pending",
  "confirmed",
  "preparing",
  "out_for_delivery",
  "delivered",
  "cancelled",
];

/** Spanish, operator-facing labels. */
export const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Pendiente",
  confirmed: "Confirmado",
  preparing: "En preparación",
  out_for_delivery: "En reparto",
  delivered: "Entregado",
  cancelled: "Cancelado",
};

/** Tailwind classes for status badges. */
export const STATUS_BADGE_CLASSES: Record<OrderStatus, string> = {
  pending: "bg-slate-100 text-slate-700 border-slate-200",
  confirmed: "bg-blue-100 text-blue-700 border-blue-200",
  preparing: "bg-amber-100 text-amber-800 border-amber-200",
  out_for_delivery: "bg-violet-100 text-violet-700 border-violet-200",
  delivered: "bg-emerald-100 text-emerald-700 border-emerald-200",
  cancelled: "bg-rose-100 text-rose-700 border-rose-200",
};

/**
 * Status state machine. Operators value speed, so transitions are permissive:
 * you may advance, step back one stage, or cancel any non-terminal order, and
 * reopen a cancelled order to pending.
 */
export const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ["confirmed", "preparing", "cancelled"],
  confirmed: ["preparing", "pending", "cancelled"],
  preparing: ["out_for_delivery", "confirmed", "cancelled"],
  out_for_delivery: ["delivered", "preparing", "cancelled"],
  delivered: ["out_for_delivery"],
  cancelled: ["pending"],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  if (from === to) return true;
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export function isValidStatus(value: string): value is OrderStatus {
  return (ORDER_STATUSES as string[]).includes(value);
}
