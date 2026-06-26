import { z } from "zod";
import { ORDER_STATUSES } from "./order-status";

const phoneRegex = /^[+()\d][\d\s().-]{5,24}$/;

export const orderItemSchema = z.object({
  productId: z.string().uuid("Producto inválido."),
  quantity: z.coerce
    .number()
    .int("La cantidad debe ser un número entero.")
    .min(1, "La cantidad mínima es 1.")
    .max(999, "Cantidad demasiado alta."),
});

export const orderBaseSchema = z.object({
  customerName: z.string().trim().min(1, "El nombre del cliente es obligatorio.").max(160),
  customerPhone: z
    .string()
    .trim()
    .min(1, "El teléfono es obligatorio.")
    .regex(phoneRegex, "Teléfono inválido."),
  // Required only for deliveries (see superRefine below); empty for pickup.
  customerAddress: z.string().trim().max(500).optional().or(z.literal("")),
  fulfillmentType: z.enum(["delivery", "pickup"]).default("delivery"),
  paymentMethodId: z.string().uuid("Forma de pago inválida.").nullish(),
  shippingMethodId: z.string().uuid("Forma de envío inválida.").nullish(),
  latitude: z.number().min(-90).max(90).nullish(),
  longitude: z.number().min(-180).max(180).nullish(),
  customerNotes: z.string().trim().max(2000).optional().or(z.literal("")),
  internalNotes: z.string().trim().max(2000).optional().or(z.literal("")),
  trackingUrl: z
    .string()
    .trim()
    .max(500)
    .url("Link de seguimiento inválido.")
    .optional()
    .or(z.literal("")),
  deliveryDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha de entrega inválida (YYYY-MM-DD)."),
  deliverySlotId: z.string().uuid("Franja horaria inválida."),
  status: z.enum(ORDER_STATUSES as [string, ...string[]]).optional(),
  items: z
    .array(orderItemSchema)
    .min(1, "Agregue al menos un caldo.")
    .superRefine((items, ctx) => {
      const total = items.reduce((s, i) => s + (i.quantity || 0), 0);
      if (total < 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "El pedido debe tener al menos un tazón.",
        });
      }
      const seen = new Set<string>();
      for (const i of items) {
        if (seen.has(i.productId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Producto duplicado en el pedido.",
          });
        }
        seen.add(i.productId);
      }
    }),
  /** Operator explicitly approved exceeding a soft capacity limit. */
  overCapacityApproved: z.coerce.boolean().optional().default(false),
}).superRefine((data, ctx) => {
  if (data.fulfillmentType === "delivery" && !data.customerAddress?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["customerAddress"],
      message: "La dirección es obligatoria para envíos a domicilio.",
    });
  }
});

export const createOrderSchema = orderBaseSchema;
export const updateOrderSchema = orderBaseSchema;

// Customer-facing self-order form (public /pedir). Restricted set of fields:
// no status, no shipping method, no over-capacity override. Includes a honeypot.
export const publicOrderSchema = z
  .object({
    customerName: z.string().trim().min(1, "Ingresá tu nombre.").max(160),
    customerPhone: z
      .string()
      .trim()
      .min(1, "Ingresá tu teléfono.")
      .regex(phoneRegex, "Teléfono inválido."),
    customerAddress: z.string().trim().max(500).optional().or(z.literal("")),
    fulfillmentType: z.enum(["delivery", "pickup"]).default("delivery"),
    paymentMethodId: z.string().uuid("Elegí una forma de pago."),
    deliveryDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida."),
    deliverySlotId: z.string().uuid("Elegí un horario."),
    items: z
      .array(orderItemSchema)
      .min(1, "Elegí al menos un plato.")
      .superRefine((items, ctx) => {
        const seen = new Set<string>();
        for (const i of items) {
          if (seen.has(i.productId)) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Producto duplicado." });
          }
          seen.add(i.productId);
        }
      }),
    customerNotes: z.string().trim().max(1000).optional().or(z.literal("")),
    /** Honeypot — must stay empty (bots fill it). */
    website: z.string().max(0).optional().or(z.literal("")),
  })
  .superRefine((data, ctx) => {
    if (data.fulfillmentType === "delivery" && !data.customerAddress?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["customerAddress"],
        message: "Ingresá tu dirección para el envío.",
      });
    }
  });

export type PublicOrderInput = z.infer<typeof publicOrderSchema>;

export type OrderInput = z.infer<typeof orderBaseSchema>;
export type OrderItemInput = z.infer<typeof orderItemSchema>;

// ── Settings / config validation ──────────────────────────────
export const capacitySettingsSchema = z
  .object({
    defaultDailyCapacity: z.coerce.number().int().min(0).max(100000),
    defaultSlotCapacity: z.coerce.number().int().min(0).max(100000),
    // Hard ceilings (0 = sin límite). Cannot be overridden when set.
    maxSlotCapacity: z.coerce.number().int().min(0).max(100000).default(0),
    maxDailyCapacity: z.coerce.number().int().min(0).max(100000).default(0),
  })
  .superRefine((d, ctx) => {
    if (d.maxSlotCapacity > 0 && d.maxSlotCapacity < d.defaultSlotCapacity) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["maxSlotCapacity"],
        message: "El máximo por franja no puede ser menor que la capacidad.",
      });
    }
    if (d.maxDailyCapacity > 0 && d.maxDailyCapacity < d.defaultDailyCapacity) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["maxDailyCapacity"],
        message: "El máximo diario no puede ser menor que la capacidad.",
      });
    }
  });

export const productSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio.").max(120),
  category: z.string().trim().min(1, "La categoría es obligatoria.").max(60).default("Ramen"),
  // Sale price in ARS centavos (integer minor units).
  priceCents: z.coerce
    .number()
    .int("El precio debe ser un monto válido.")
    .min(0, "El precio no puede ser negativo.")
    .max(1_000_000_00, "Precio demasiado alto.")
    .default(0),
  isActive: z.coerce.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).default(0),
});

// Volume discount: "from N units of a category, X% off the category subtotal".
export const volumeDiscountSchema = z.object({
  category: z.string().trim().min(1, "La categoría es obligatoria.").max(60),
  minQuantity: z.coerce
    .number()
    .int("La cantidad debe ser un número entero.")
    .min(2, "El mínimo para un descuento por cantidad es 2."),
  // Discount in basis points (625 = 6.25%). 1–10000 (0.01%–100%).
  discountBps: z.coerce
    .number()
    .int()
    .min(1, "El descuento debe ser mayor a 0.")
    .max(10000, "El descuento no puede superar el 100%."),
  isActive: z.coerce.boolean().default(true),
});

export const deliverySlotSchema = z.object({
  label: z.string().trim().min(1, "La etiqueta es obligatoria.").max(60),
  startTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Hora de inicio inválida."),
  endTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Hora de fin inválida."),
  capacityLimit: z.coerce.number().int().min(0).max(100000),
  // Standard shipping cost for this slot, in ARS centavos.
  shippingCostCents: z.coerce.number().int().min(0).max(1_000_000_00).default(0),
  isActive: z.coerce.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).default(0),
});

// Actual shipping cost recorded for a delivery run (date + slot) in /routes.
export const deliveryRunSchema = z.object({
  deliveryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida (YYYY-MM-DD)."),
  slotId: z.string().uuid("Franja inválida."),
  shippingMethodId: z.string().uuid("Forma de envío inválida.").nullish(),
  actualCostCents: z.coerce.number().int().min(0).max(1_000_000_00).default(0),
});

// Shared shape for simple configurable lists (payment + shipping methods).
export const namedOptionSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio.").max(80),
  isActive: z.coerce.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).default(0),
});

export const brandingSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio.").max(120),
  nameShort: z.string().trim().min(1, "El nombre corto es obligatorio.").max(60),
  description: z.string().trim().max(200).optional().or(z.literal("")),
});

export const brandingLogoSchema = z.object({
  // Resized client-side; kept small. data:image/...;base64,...
  logo: z
    .string()
    .trim()
    .regex(/^data:image\/(png|jpeg|webp);base64,/, "Imagen inválida.")
    .max(700_000, "El logo es demasiado grande."),
});

export const messageTemplateSchema = z.object({
  status: z.enum(ORDER_STATUSES as [string, ...string[]]),
  body: z.string().trim().min(1, "El mensaje no puede estar vacío.").max(4000),
});

export const DELIVERY_DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

export const deliveryDaysSchema = z.object({
  activeDeliveryDays: z.array(z.enum(DELIVERY_DAYS)).min(0),
});

export const originSchema = z.object({
  originAddress: z.string().trim().max(500).optional().or(z.literal("")),
  originLat: z.number().min(-90).max(90).nullish(),
  originLng: z.number().min(-180).max(180).nullish(),
});

export const searchAreaSchema = z.object({
  searchLabel: z.string().trim().min(1, "El nombre es obligatorio.").max(120),
  searchCenterLat: z.number().min(-90).max(90),
  searchCenterLng: z.number().min(-180).max(180),
  searchRadiusKm: z.coerce.number().min(1, "Mínimo 1 km.").max(200, "Máximo 200 km."),
});
