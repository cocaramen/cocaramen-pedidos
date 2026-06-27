import "server-only";
import { db } from "@/db";
import { settings, SETTING_KEYS } from "@/db/schema";
import { inArray } from "drizzle-orm";
import { APP_NAME, APP_NAME_SHORT, APP_DESCRIPTION } from "@/lib/app";

export interface Branding {
  name: string;
  nameShort: string;
  description: string;
  /** Logo as a data URI, or null to use the bundled /logo.png. */
  logo: string | null;
}

/**
 * Configurable business branding (Settings → Marca). Kept separate from
 * getSettings() so the (potentially large) logo data URI is only loaded where
 * the brand is actually rendered. Falls back to the bundled defaults.
 */
const DEFAULT_BRANDING: Branding = {
  name: APP_NAME,
  nameShort: APP_NAME_SHORT,
  description: APP_DESCRIPTION,
  logo: null,
};

export async function getBranding(): Promise<Branding> {
  // Runs at build time too (root layout generateMetadata → /_not-found). Never
  // throw on a DB hiccup / no DB at build — fall back to the bundled defaults.
  try {
    const rows = await db
      .select()
      .from(settings)
      .where(
        inArray(settings.key, [
          SETTING_KEYS.BUSINESS_NAME,
          SETTING_KEYS.BUSINESS_NAME_SHORT,
          SETTING_KEYS.BUSINESS_DESCRIPTION,
          SETTING_KEYS.BUSINESS_LOGO,
        ]),
      );
    const map = new Map(rows.map((r) => [r.key, r.value]));
    return {
      name: map.get(SETTING_KEYS.BUSINESS_NAME)?.trim() || APP_NAME,
      nameShort: map.get(SETTING_KEYS.BUSINESS_NAME_SHORT)?.trim() || APP_NAME_SHORT,
      description: map.get(SETTING_KEYS.BUSINESS_DESCRIPTION)?.trim() || APP_DESCRIPTION,
      logo: map.get(SETTING_KEYS.BUSINESS_LOGO)?.trim() || null,
    };
  } catch {
    return DEFAULT_BRANDING;
  }
}

export interface AppSettings {
  defaultSlotCapacity: number;
  defaultDailyCapacity: number;
  /** Hard ceilings (0 = no hard limit). Cannot be overridden when set. */
  maxSlotCapacity: number;
  maxDailyCapacity: number;
  activeDeliveryDays: string[];
  /** Delivery origin (kitchen). Null coords = not configured. */
  originAddress: string | null;
  originLat: number | null;
  originLng: number | null;
  /** Address-autocomplete search area for the order form. */
  searchLabel: string;
  searchCenterLat: number;
  searchCenterLng: number;
  searchRadiusKm: number;
}

const DEFAULTS: AppSettings = {
  defaultSlotCapacity: 6,
  defaultDailyCapacity: 24,
  maxSlotCapacity: 0,
  maxDailyCapacity: 0,
  activeDeliveryDays: ["friday"],
  originAddress: null,
  originLat: null,
  originLng: null,
  searchLabel: "San Miguel de Tucumán",
  searchCenterLat: -26.8333,
  searchCenterLng: -65.2167,
  searchRadiusKm: 10,
};

export async function getSettings(): Promise<AppSettings> {
  const rows = await db
    .select()
    .from(settings)
    .where(
      inArray(settings.key, [
        SETTING_KEYS.DEFAULT_SLOT_CAPACITY,
        SETTING_KEYS.DEFAULT_DAILY_CAPACITY,
        SETTING_KEYS.MAX_SLOT_CAPACITY,
        SETTING_KEYS.MAX_DAILY_CAPACITY,
        SETTING_KEYS.ACTIVE_DELIVERY_DAYS,
        SETTING_KEYS.ORIGIN_ADDRESS,
        SETTING_KEYS.ORIGIN_LAT,
        SETTING_KEYS.ORIGIN_LNG,
        SETTING_KEYS.SEARCH_LABEL,
        SETTING_KEYS.SEARCH_CENTER_LAT,
        SETTING_KEYS.SEARCH_CENTER_LNG,
        SETTING_KEYS.SEARCH_RADIUS_KM,
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
    maxSlotCapacity: numberOr(map.get(SETTING_KEYS.MAX_SLOT_CAPACITY), DEFAULTS.maxSlotCapacity),
    maxDailyCapacity: numberOr(
      map.get(SETTING_KEYS.MAX_DAILY_CAPACITY),
      DEFAULTS.maxDailyCapacity,
    ),
    activeDeliveryDays: parseDays(map.get(SETTING_KEYS.ACTIVE_DELIVERY_DAYS)),
    originAddress: map.get(SETTING_KEYS.ORIGIN_ADDRESS) || null,
    originLat: numberOrNull(map.get(SETTING_KEYS.ORIGIN_LAT)),
    originLng: numberOrNull(map.get(SETTING_KEYS.ORIGIN_LNG)),
    searchLabel: map.get(SETTING_KEYS.SEARCH_LABEL) || DEFAULTS.searchLabel,
    searchCenterLat: numberOr(map.get(SETTING_KEYS.SEARCH_CENTER_LAT), DEFAULTS.searchCenterLat),
    searchCenterLng: numberOr(map.get(SETTING_KEYS.SEARCH_CENTER_LNG), DEFAULTS.searchCenterLng),
    searchRadiusKm: numberOr(map.get(SETTING_KEYS.SEARCH_RADIUS_KM), DEFAULTS.searchRadiusKm),
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

function numberOrNull(value: string | undefined): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function parseDays(value: string | undefined): string[] {
  if (!value) return DEFAULTS.activeDeliveryDays;
  return value
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
}
