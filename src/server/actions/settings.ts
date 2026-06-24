"use server";

import { db } from "@/db";
import { brothTypes, deliverySlots } from "@/db/schema";
import { SETTING_KEYS } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { setSetting } from "@/server/settings";
import {
  brothTypeSchema,
  capacitySettingsSchema,
  deliveryDaysSchema,
  deliverySlotSchema,
  originSchema,
  searchAreaSchema,
} from "@/lib/validation";
import { type ActionResult, ok, fail } from "@/lib/action-result";
import { requireUser } from "@/lib/auth/session";

function revalidateSettings() {
  revalidatePath("/settings");
  revalidatePath("/");
  revalidatePath("/orders");
  revalidatePath("/orders/new");
  revalidatePath("/routes");
}

// ── Delivery origin (kitchen) ──────────────────────────────────
export async function updateDeliveryOrigin(input: unknown): Promise<ActionResult> {
  await requireUser();
  const parsed = originSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Datos inválidos.", { fieldErrors: parsed.error.flatten().fieldErrors });
  }
  await setSetting(SETTING_KEYS.ORIGIN_ADDRESS, parsed.data.originAddress ?? "");
  await setSetting(
    SETTING_KEYS.ORIGIN_LAT,
    parsed.data.originLat != null ? String(parsed.data.originLat) : "",
  );
  await setSetting(
    SETTING_KEYS.ORIGIN_LNG,
    parsed.data.originLng != null ? String(parsed.data.originLng) : "",
  );
  revalidateSettings();
  return ok(undefined);
}

// ── Address search area (order form autocomplete) ──────────────
export async function updateSearchArea(input: unknown): Promise<ActionResult> {
  await requireUser();
  const parsed = searchAreaSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Datos inválidos.", { fieldErrors: parsed.error.flatten().fieldErrors });
  }
  await setSetting(SETTING_KEYS.SEARCH_LABEL, parsed.data.searchLabel);
  await setSetting(SETTING_KEYS.SEARCH_CENTER_LAT, String(parsed.data.searchCenterLat));
  await setSetting(SETTING_KEYS.SEARCH_CENTER_LNG, String(parsed.data.searchCenterLng));
  await setSetting(SETTING_KEYS.SEARCH_RADIUS_KM, String(parsed.data.searchRadiusKm));
  revalidateSettings();
  return ok(undefined);
}

// ── Capacity ───────────────────────────────────────────────────
export async function updateCapacitySettings(input: unknown): Promise<ActionResult> {
  await requireUser();
  const parsed = capacitySettingsSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Datos inválidos.", { fieldErrors: parsed.error.flatten().fieldErrors });
  }
  await setSetting(
    SETTING_KEYS.DEFAULT_DAILY_CAPACITY,
    String(parsed.data.defaultDailyCapacity),
  );
  await setSetting(
    SETTING_KEYS.DEFAULT_SLOT_CAPACITY,
    String(parsed.data.defaultSlotCapacity),
  );
  revalidateSettings();
  return ok(undefined);
}

// ── Delivery days ──────────────────────────────────────────────
export async function updateDeliveryDays(input: unknown): Promise<ActionResult> {
  await requireUser();
  const parsed = deliveryDaysSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Días inválidos.", { fieldErrors: parsed.error.flatten().fieldErrors });
  }
  await setSetting(
    SETTING_KEYS.ACTIVE_DELIVERY_DAYS,
    parsed.data.activeDeliveryDays.join(","),
  );
  revalidateSettings();
  return ok(undefined);
}

// ── Broth types ────────────────────────────────────────────────
export async function createBrothType(input: unknown): Promise<ActionResult<{ id: string }>> {
  await requireUser();
  const parsed = brothTypeSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Datos inválidos.", { fieldErrors: parsed.error.flatten().fieldErrors });
  }
  try {
    const [row] = await db
      .insert(brothTypes)
      .values(parsed.data)
      .returning({ id: brothTypes.id });
    revalidateSettings();
    return ok({ id: row.id });
  } catch {
    return fail("Ya existe un caldo con ese nombre.");
  }
}

export async function updateBrothType(
  id: string,
  input: unknown,
): Promise<ActionResult> {
  await requireUser();
  const parsed = brothTypeSchema.partial().safeParse(input);
  if (!parsed.success) {
    return fail("Datos inválidos.", { fieldErrors: parsed.error.flatten().fieldErrors });
  }
  await db.update(brothTypes).set(parsed.data).where(eq(brothTypes.id, id));
  revalidateSettings();
  return ok(undefined);
}

export async function setBrothTypeActive(id: string, isActive: boolean): Promise<ActionResult> {
  await requireUser();
  await db.update(brothTypes).set({ isActive }).where(eq(brothTypes.id, id));
  revalidateSettings();
  return ok(undefined);
}

// ── Delivery slots ─────────────────────────────────────────────
export async function createSlot(input: unknown): Promise<ActionResult<{ id: string }>> {
  await requireUser();
  const parsed = deliverySlotSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Datos inválidos.", { fieldErrors: parsed.error.flatten().fieldErrors });
  }
  try {
    const [row] = await db
      .insert(deliverySlots)
      .values(parsed.data)
      .returning({ id: deliverySlots.id });
    revalidateSettings();
    return ok({ id: row.id });
  } catch {
    return fail("Ya existe una franja con esa etiqueta.");
  }
}

export async function updateSlot(id: string, input: unknown): Promise<ActionResult> {
  await requireUser();
  const parsed = deliverySlotSchema.partial().safeParse(input);
  if (!parsed.success) {
    return fail("Datos inválidos.", { fieldErrors: parsed.error.flatten().fieldErrors });
  }
  await db.update(deliverySlots).set(parsed.data).where(eq(deliverySlots.id, id));
  revalidateSettings();
  return ok(undefined);
}

export async function setSlotActive(id: string, isActive: boolean): Promise<ActionResult> {
  await requireUser();
  await db.update(deliverySlots).set({ isActive }).where(eq(deliverySlots.id, id));
  revalidateSettings();
  return ok(undefined);
}
