import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

export const WEEKDAY_LABELS_ES: Record<string, string> = {
  monday: "Lunes",
  tuesday: "Martes",
  wednesday: "Miércoles",
  thursday: "Jueves",
  friday: "Viernes",
  saturday: "Sábado",
  sunday: "Domingo",
};

const WEEKDAY_INDEX: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

/** Today's date as YYYY-MM-DD in local time. */
export function todayISO(now: Date = new Date()): string {
  return format(now, "yyyy-MM-dd");
}

/** Human, Spanish long date, e.g. "viernes, 27 de junio de 2026". */
export function formatLongDate(isoDate: string): string {
  return format(parseISO(isoDate), "EEEE, d 'de' MMMM 'de' yyyy", { locale: es });
}

/** Short Spanish date, e.g. "vie 27 jun". */
export function formatShortDate(isoDate: string): string {
  return format(parseISO(isoDate), "EEE d MMM", { locale: es });
}

/** Lowercase english weekday key for an ISO date (e.g. "friday"). */
export function weekdayKey(isoDate: string): string {
  const idx = parseISO(isoDate).getDay();
  return Object.keys(WEEKDAY_INDEX).find((k) => WEEKDAY_INDEX[k] === idx) ?? "monday";
}

/** True when the ISO date falls on one of the active delivery weekdays. */
export function isActiveDeliveryDay(isoDate: string, activeDays: string[]): boolean {
  return activeDays.includes(weekdayKey(isoDate));
}

/**
 * The next upcoming date (YYYY-MM-DD) matching one of the active delivery days,
 * including today. Falls back to today when no active days are configured.
 */
export function nextDeliveryDate(activeDays: string[], now: Date = new Date()): string {
  if (activeDays.length === 0) return todayISO(now);
  const targets = activeDays
    .map((d) => WEEKDAY_INDEX[d])
    .filter((n): n is number => n !== undefined);
  for (let offset = 0; offset < 14; offset++) {
    const candidate = new Date(now);
    candidate.setDate(now.getDate() + offset);
    if (targets.includes(candidate.getDay())) {
      return format(candidate, "yyyy-MM-dd");
    }
  }
  return todayISO(now);
}

/** "21:00:00" -> "21:00" */
export function trimTime(t: string): string {
  return t.slice(0, 5);
}
