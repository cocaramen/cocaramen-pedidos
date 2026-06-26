/**
 * Capacity business rules.
 *
 * These are SOFT limits: exceeding them produces warnings and sets flags,
 * but it never blocks order creation or editing. The operator may always
 * approve and save anyway (manual override).
 *
 * All functions here are PURE so they can be unit-tested without a database
 * and reused on both the server (authoritative) and the client (live preview).
 */

export interface CapacitySnapshot {
  /** Bowls already booked in this slot on this date, EXCLUDING the order being edited. */
  slotBowls: number;
  /** Bowls already booked across the whole date, EXCLUDING the order being edited. */
  dailyBowls: number;
  /** Soft capacity limit for the target slot (exceeding warns + needs approval). */
  slotCapacity: number;
  /** Soft daily capacity limit. */
  dailyCapacity: number;
  /** Hard slot ceiling — cannot be overridden. 0 = no hard limit. */
  slotMaxCapacity?: number;
  /** Hard daily ceiling — cannot be overridden. 0 = no hard limit. */
  dailyMaxCapacity?: number;
}

export interface CapacityEvaluation {
  orderBowls: number;
  newSlotTotal: number;
  newDailyTotal: number;
  slotCapacity: number;
  dailyCapacity: number;
  /** Remaining capacity AFTER this order. May be negative when exceeded. */
  slotRemaining: number;
  dailyRemaining: number;
  exceededSlotCapacity: boolean;
  exceededDailyCapacity: boolean;
  /** True when either soft limit is exceeded → operator must explicitly approve. */
  requiresApproval: boolean;
  /** Hard ceilings (0 = disabled) and whether this order breaks them. */
  slotMaxCapacity: number;
  dailyMaxCapacity: number;
  exceededSlotMax: boolean;
  exceededDailyMax: boolean;
  /** True when a hard ceiling is exceeded → CANNOT be saved (no override). */
  hardBlocked: boolean;
  /** Spanish, operator-facing warning text. Undefined when within capacity. */
  slotWarning?: string;
  dailyWarning?: string;
  /** Spanish, blocking text shown when hardBlocked. */
  hardWarning?: string;
}

/** Sum the quantities of a set of order items. */
export function sumBowls(items: { quantity: number }[]): number {
  return items.reduce((total, item) => total + Math.max(0, item.quantity || 0), 0);
}

/**
 * Evaluate the capacity impact of placing `orderBowls` into the slot/date
 * described by `snapshot`. The snapshot must already EXCLUDE the order being
 * edited so we never double-count it.
 */
export function evaluateCapacity(
  snapshot: CapacitySnapshot,
  orderBowls: number,
): CapacityEvaluation {
  const bowls = Math.max(0, orderBowls);
  const newSlotTotal = snapshot.slotBowls + bowls;
  const newDailyTotal = snapshot.dailyBowls + bowls;

  const slotRemaining = snapshot.slotCapacity - newSlotTotal;
  const dailyRemaining = snapshot.dailyCapacity - newDailyTotal;

  const exceededSlotCapacity = newSlotTotal > snapshot.slotCapacity;
  const exceededDailyCapacity = newDailyTotal > snapshot.dailyCapacity;

  // Hard ceilings (0 = disabled). These BLOCK saving — no operator override.
  const slotMaxCapacity = snapshot.slotMaxCapacity ?? 0;
  const dailyMaxCapacity = snapshot.dailyMaxCapacity ?? 0;
  const exceededSlotMax = slotMaxCapacity > 0 && newSlotTotal > slotMaxCapacity;
  const exceededDailyMax = dailyMaxCapacity > 0 && newDailyTotal > dailyMaxCapacity;
  const hardBlocked = exceededSlotMax || exceededDailyMax;

  return {
    orderBowls: bowls,
    newSlotTotal,
    newDailyTotal,
    slotCapacity: snapshot.slotCapacity,
    dailyCapacity: snapshot.dailyCapacity,
    slotRemaining,
    dailyRemaining,
    exceededSlotCapacity,
    exceededDailyCapacity,
    requiresApproval: exceededSlotCapacity || exceededDailyCapacity,
    slotMaxCapacity,
    dailyMaxCapacity,
    exceededSlotMax,
    exceededDailyMax,
    hardBlocked,
    hardWarning: exceededSlotMax
      ? `Esta franja admite como máximo ${slotMaxCapacity} ${pluralBowls(
          slotMaxCapacity,
        )} y este pedido la llevaría a ${newSlotTotal}. No se puede guardar; reducí la cantidad o elegí otra franja.`
      : exceededDailyMax
        ? `El máximo diario es de ${dailyMaxCapacity} ${pluralBowls(
            dailyMaxCapacity,
          )} y este pedido llevaría el día a ${newDailyTotal}. No se puede guardar; reducí la cantidad o cambiá la fecha.`
        : undefined,
    slotWarning: exceededSlotCapacity
      ? `Esta franja horaria contiene actualmente ${snapshot.slotBowls} ${pluralBowls(
          snapshot.slotBowls,
        )}. Este pedido aumentaría el total a ${newSlotTotal} ${pluralBowls(
          newSlotTotal,
        )} (límite ${snapshot.slotCapacity}). Por favor revise antes de confirmar.`
      : undefined,
    dailyWarning: exceededDailyCapacity
      ? `La capacidad diaria es de ${snapshot.dailyCapacity} ${pluralBowls(
          snapshot.dailyCapacity,
        )}. Este pedido aumentaría el total del día a ${newDailyTotal} ${pluralBowls(
          newDailyTotal,
        )}. Por favor revise antes de confirmar.`
      : undefined,
  };
}

function pluralBowls(n: number): string {
  return n === 1 ? "tazón" : "tazones";
}

/** A 0–100+ utilization percentage (capped getter provided separately for bars). */
export function utilizationPct(used: number, capacity: number): number {
  if (capacity <= 0) return used > 0 ? 100 : 0;
  return Math.round((used / capacity) * 100);
}
