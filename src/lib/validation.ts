import { z } from "zod";
import { ORDER_STATUSES } from "./order-status";

const phoneRegex = /^[+()\d][\d\s().-]{5,24}$/;

export const orderItemSchema = z.object({
  brothTypeId: z.string().uuid("Tipo de caldo inválido."),
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
  customerAddress: z.string().trim().min(1, "La dirección es obligatoria.").max(500),
  customerNotes: z.string().trim().max(2000).optional().or(z.literal("")),
  internalNotes: z.string().trim().max(2000).optional().or(z.literal("")),
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
        if (seen.has(i.brothTypeId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Tipo de caldo duplicado en el pedido.",
          });
        }
        seen.add(i.brothTypeId);
      }
    }),
  /** Operator explicitly approved exceeding a soft capacity limit. */
  overCapacityApproved: z.coerce.boolean().optional().default(false),
});

export const createOrderSchema = orderBaseSchema;
export const updateOrderSchema = orderBaseSchema;

export type OrderInput = z.infer<typeof orderBaseSchema>;
export type OrderItemInput = z.infer<typeof orderItemSchema>;

// ── Settings / config validation ──────────────────────────────
export const capacitySettingsSchema = z.object({
  defaultDailyCapacity: z.coerce.number().int().min(0).max(100000),
  defaultSlotCapacity: z.coerce.number().int().min(0).max(100000),
});

export const brothTypeSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio.").max(120),
  isActive: z.coerce.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).default(0),
});

export const deliverySlotSchema = z.object({
  label: z.string().trim().min(1, "La etiqueta es obligatoria.").max(60),
  startTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Hora de inicio inválida."),
  endTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Hora de fin inválida."),
  capacityLimit: z.coerce.number().int().min(0).max(100000),
  isActive: z.coerce.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).default(0),
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
