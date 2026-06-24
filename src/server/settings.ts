import "server-only";
import { db } from "@/db";
import { settings, SETTING_KEYS } from "@/db/schema";
import { inArray } from "drizzle-orm";

export interface AppSettings {
  defaultSlotCapacity: number;
  defaultDailyCapacity: number;
  activeDeliveryDays: string[];
}

const DEFAULTS: AppSettings = {
  defaultSlotCapacity: 6,
  defaultDailyCapacity: 24,
  activeDeliveryDays: ["friday"],
};

export async function getSettings(): Promise<AppSettings> {
  const rows = await db
    .select()
    .from(settings)
    .where(
      inArray(settings.key, [
        SETTING_KEYS.DEFAULT_SLOT_CAPACITY,
        SETTING_KEYS.DEFAULT_DAILY_CAPACITY,
        SETTING_KEYS.ACTIVE_DELIVERY_DAYS,
      ]),
    );

  const map = new Map(rows.map((r) => [r.key, r.value]));

  return {
    defaultSlotCapacity: numberOr(
      map.get(SETTING_KEYS.DEFAULT_SLOT_CAPACITY),
      DEFAULTS.defaultSlotCapacity,
    ),
    defaultDailyCapacity: numberOr(
      map.get(SETTING_KEYS.DEFAULT_DAILY_CAPACITY),
      DEFAULTS.defaultDailyCapacity,
    ),
    activeDeliveryDays: parseDays(map.get(SETTING_KEYS.ACTIVE_DELIVERY_DAYS)),
  };
}

export async function setSetting(key: string, value: string): Promise<void> {
  await db
    .insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: settings.key, set: { value } });
}

function numberOr(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function parseDays(value: string | undefined): string[] {
  if (!value) return DEFAULTS.activeDeliveryDays;
  return value
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
}
