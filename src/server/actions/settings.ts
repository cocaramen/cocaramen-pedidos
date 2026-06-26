"use server";

import { db } from "@/db";
import {
  products,
  deliverySlots,
  volumeDiscounts,
  messageTemplates,
  paymentMethods,
  shippingMethods,
} from "@/db/schema";
import { SETTING_KEYS } from "@/db/schema";
import type { OrderStatus } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { setSetting, getBranding } from "@/server/settings";
import {
  storageConfigured,
  uploadPublicImage,
  removeFromBucket,
  parseDataUri,
  publicUrlToPath,
} from "@/lib/supabase/storage";

const LOGO_BUCKET = "branding";
import {
  productSchema,
  volumeDiscountSchema,
  messageTemplateSchema,
  namedOptionSchema,
  brandingSchema,
  brandingLogoSchema,
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
  await setSetting(SETTING_KEYS.MAX_SLOT_CAPACITY, String(parsed.data.maxSlotCapacity));
  await setSetting(SETTING_KEYS.MAX_DAILY_CAPACITY, String(parsed.data.maxDailyCapacity));
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

// ── Branding (name, short name, description, logo) ─────────────
function revalidateBranding() {
  // The brand renders in the shared layout + login + public order page.
  revalidatePath("/", "layout");
  revalidatePath("/login");
}

export async function updateBranding(input: unknown): Promise<ActionResult> {
  await requireUser();
  const parsed = brandingSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Datos inválidos.", { fieldErrors: parsed.error.flatten().fieldErrors });
  }
  await setSetting(SETTING_KEYS.BUSINESS_NAME, parsed.data.name);
  await setSetting(SETTING_KEYS.BUSINESS_NAME_SHORT, parsed.data.nameShort);
  await setSetting(SETTING_KEYS.BUSINESS_DESCRIPTION, parsed.data.description ?? "");
  revalidateBranding();
  return ok(undefined);
}

export async function updateBrandingLogo(input: unknown): Promise<ActionResult> {
  await requireUser();
  const parsed = brandingLogoSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Imagen inválida.", { fieldErrors: parsed.error.flatten().fieldErrors });
  }

  const prev = (await getBranding()).logo;
  let value = parsed.data.logo; // data URI — the fallback when Storage is off.

  if (storageConfigured()) {
    try {
      const img = parseDataUri(parsed.data.logo);
      if (img) {
        const ext = img.contentType.split("/")[1] || "webp";
        value = await uploadPublicImage({
          bucket: LOGO_BUCKET,
          path: `logo-${Date.now()}.${ext}`,
          bytes: img.bytes,
          contentType: img.contentType,
        });
      }
    } catch {
      value = parsed.data.logo; // upload failed → keep the inline data URI
    }
  }

  await setSetting(SETTING_KEYS.BUSINESS_LOGO, value);

  // Remove the previous Storage object if it was ours.
  if (prev && prev !== value) {
    const prevPath = publicUrlToPath(prev, LOGO_BUCKET);
    if (prevPath) await removeFromBucket(LOGO_BUCKET, prevPath);
  }

  revalidateBranding();
  return ok(undefined);
}

export async function clearBrandingLogo(): Promise<ActionResult> {
  await requireUser();
  const prev = (await getBranding()).logo;
  await setSetting(SETTING_KEYS.BUSINESS_LOGO, "");
  if (prev) {
    const prevPath = publicUrlToPath(prev, LOGO_BUCKET);
    if (prevPath) await removeFromBucket(LOGO_BUCKET, prevPath);
  }
  revalidateBranding();
  return ok(undefined);
}

// ── Products ───────────────────────────────────────────────────
export async function createProduct(input: unknown): Promise<ActionResult<{ id: string }>> {
  await requireUser();
  const parsed = productSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Datos inválidos.", { fieldErrors: parsed.error.flatten().fieldErrors });
  }
  try {
    const [row] = await db
      .insert(products)
      .values(parsed.data)
      .returning({ id: products.id });
    revalidateSettings();
    return ok({ id: row.id });
  } catch {
    return fail("Ya existe un producto con ese nombre.");
  }
}

export async function updateProduct(
  id: string,
  input: unknown,
): Promise<ActionResult> {
  await requireUser();
  const parsed = productSchema.partial().safeParse(input);
  if (!parsed.success) {
    return fail("Datos inválidos.", { fieldErrors: parsed.error.flatten().fieldErrors });
  }
  await db.update(products).set(parsed.data).where(eq(products.id, id));
  revalidateSettings();
  return ok(undefined);
}

export async function setProductActive(id: string, isActive: boolean): Promise<ActionResult> {
  await requireUser();
  await db.update(products).set({ isActive }).where(eq(products.id, id));
  revalidateSettings();
  return ok(undefined);
}

// ── Volume discounts ───────────────────────────────────────────
export async function createVolumeDiscount(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  await requireUser();
  const parsed = volumeDiscountSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Datos inválidos.", { fieldErrors: parsed.error.flatten().fieldErrors });
  }
  try {
    const [row] = await db
      .insert(volumeDiscounts)
      .values(parsed.data)
      .returning({ id: volumeDiscounts.id });
    revalidateSettings();
    return ok({ id: row.id });
  } catch {
    return fail("Ya existe un descuento para esa categoría y cantidad.");
  }
}

export async function updateVolumeDiscount(
  id: string,
  input: unknown,
): Promise<ActionResult> {
  await requireUser();
  const parsed = volumeDiscountSchema.partial().safeParse(input);
  if (!parsed.success) {
    return fail("Datos inválidos.", { fieldErrors: parsed.error.flatten().fieldErrors });
  }
  try {
    await db.update(volumeDiscounts).set(parsed.data).where(eq(volumeDiscounts.id, id));
    revalidateSettings();
    return ok(undefined);
  } catch {
    return fail("Ya existe un descuento para esa categoría y cantidad.");
  }
}

export async function setVolumeDiscountActive(
  id: string,
  isActive: boolean,
): Promise<ActionResult> {
  await requireUser();
  await db.update(volumeDiscounts).set({ isActive }).where(eq(volumeDiscounts.id, id));
  revalidateSettings();
  return ok(undefined);
}

export async function deleteVolumeDiscount(id: string): Promise<ActionResult> {
  await requireUser();
  await db.delete(volumeDiscounts).where(eq(volumeDiscounts.id, id));
  revalidateSettings();
  return ok(undefined);
}

// ── Payment methods ────────────────────────────────────────────
export async function createPaymentMethod(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  await requireUser();
  const parsed = namedOptionSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Datos inválidos.", { fieldErrors: parsed.error.flatten().fieldErrors });
  }
  try {
    const [row] = await db
      .insert(paymentMethods)
      .values(parsed.data)
      .returning({ id: paymentMethods.id });
    revalidateSettings();
    return ok({ id: row.id });
  } catch {
    return fail("Ya existe una forma de pago con ese nombre.");
  }
}

export async function updatePaymentMethod(id: string, input: unknown): Promise<ActionResult> {
  await requireUser();
  const parsed = namedOptionSchema.partial().safeParse(input);
  if (!parsed.success) {
    return fail("Datos inválidos.", { fieldErrors: parsed.error.flatten().fieldErrors });
  }
  await db.update(paymentMethods).set(parsed.data).where(eq(paymentMethods.id, id));
  revalidateSettings();
  return ok(undefined);
}

export async function setPaymentMethodActive(
  id: string,
  isActive: boolean,
): Promise<ActionResult> {
  await requireUser();
  await db.update(paymentMethods).set({ isActive }).where(eq(paymentMethods.id, id));
  revalidateSettings();
  return ok(undefined);
}

export async function setPaymentMethodRequiresReceipt(
  id: string,
  requiresReceipt: boolean,
): Promise<ActionResult> {
  await requireUser();
  await db.update(paymentMethods).set({ requiresReceipt }).where(eq(paymentMethods.id, id));
  revalidateSettings();
  return ok(undefined);
}

// ── Shipping methods ───────────────────────────────────────────
export async function createShippingMethod(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  await requireUser();
  const parsed = namedOptionSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Datos inválidos.", { fieldErrors: parsed.error.flatten().fieldErrors });
  }
  try {
    const [row] = await db
      .insert(shippingMethods)
      .values(parsed.data)
      .returning({ id: shippingMethods.id });
    revalidateSettings();
    return ok({ id: row.id });
  } catch {
    return fail("Ya existe una forma de envío con ese nombre.");
  }
}

export async function updateShippingMethod(id: string, input: unknown): Promise<ActionResult> {
  await requireUser();
  const parsed = namedOptionSchema.partial().safeParse(input);
  if (!parsed.success) {
    return fail("Datos inválidos.", { fieldErrors: parsed.error.flatten().fieldErrors });
  }
  await db.update(shippingMethods).set(parsed.data).where(eq(shippingMethods.id, id));
  revalidateSettings();
  return ok(undefined);
}

export async function setShippingMethodActive(
  id: string,
  isActive: boolean,
): Promise<ActionResult> {
  await requireUser();
  await db.update(shippingMethods).set({ isActive }).where(eq(shippingMethods.id, id));
  revalidateSettings();
  return ok(undefined);
}

// ── Message templates ──────────────────────────────────────────
export async function saveMessageTemplate(input: unknown): Promise<ActionResult> {
  await requireUser();
  const parsed = messageTemplateSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Datos inválidos.", { fieldErrors: parsed.error.flatten().fieldErrors });
  }
  await db
    .insert(messageTemplates)
    .values({ status: parsed.data.status as OrderStatus, body: parsed.data.body })
    .onConflictDoUpdate({
      target: messageTemplates.status,
      set: { body: parsed.data.body },
    });
  revalidateSettings();
  return ok(undefined);
}

/** Restore a status to its built-in default by removing the saved override. */
export async function resetMessageTemplate(status: string): Promise<ActionResult> {
  await requireUser();
  await db.delete(messageTemplates).where(eq(messageTemplates.status, status as never));
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
