// Customer message templates per order status. Pure + client-safe: used both
// for the live preview in Settings and to build the copy/WhatsApp text per
// order. Placeholders use {{name}} and are filled from the order data.

import type { OrderStatus } from "@/db/schema";
import { STATUS_LABELS } from "@/lib/order-status";
import { formatArs } from "@/lib/money";
import { formatLongDate, trimTime } from "@/lib/dates";
import { priceOrder, type PricingTier } from "@/lib/pricing";
import { APP_NAME_SHORT } from "@/lib/app";

export interface PlaceholderInfo {
  key: string;
  label: string;
}

/** Available placeholders, shown as help in the editor. */
export const MESSAGE_PLACEHOLDERS: PlaceholderInfo[] = [
  { key: "cliente", label: "Nombre del cliente" },
  { key: "telefono", label: "Teléfono" },
  { key: "direccion", label: "Dirección de entrega" },
  { key: "fecha", label: "Fecha de entrega" },
  { key: "franja", label: "Franja horaria" },
  { key: "items", label: "Detalle de platos (2× Caldo de Pollo, …)" },
  { key: "cantidad", label: "Cantidad total de tazones" },
  { key: "subtotal", label: "Subtotal (ARS)" },
  { key: "descuento", label: "Descuento por cantidad (ARS)" },
  { key: "total", label: "Total a pagar (ARS)" },
  { key: "estado", label: "Estado del pedido" },
  { key: "pago", label: "Forma de pago" },
  { key: "envio", label: "Forma de envío / retiro" },
  { key: "notas", label: "Observaciones del cliente" },
  { key: "seguimiento", label: "Link de seguimiento (si el pedido tiene)" },
  { key: "enlace", label: "Enlace público con el detalle del pedido" },
  { key: "negocio", label: "Nombre del negocio" },
];

/** Default Spanish templates. Lines that resolve to empty are dropped. */
export const DEFAULT_TEMPLATES: Record<OrderStatus, string> = {
  pending: `¡Hola {{cliente}}! 👋 Recibimos tu pedido en {{negocio}}:
{{items}}
📅 {{fecha}} ({{franja}})
🛵 {{envio}}
📍 {{direccion}}
💰 Total: {{total}} ({{pago}})
Te lo confirmamos en un ratito. ¡Gracias!`,

  confirmed: `¡Hola {{cliente}}! ✅ Tu pedido está *confirmado*:
{{items}}
📅 {{fecha}} ({{franja}})
🛵 {{envio}}
📍 {{direccion}}
💰 Total: {{total}} ({{pago}})
🔎 Mirá el detalle y el estado de tu pedido: {{enlace}}
Cualquier modificación, escribinos. ¡Gracias por elegir {{negocio}}!`,

  preparing: `¡Hola {{cliente}}! 👨‍🍳 Tu pedido ya está *en preparación*:
{{items}}
📅 Hoy {{fecha}} ({{franja}})
Te avisamos apenas salga para la entrega.`,

  out_for_delivery: `¡Hola {{cliente}}! 🛵 Tu pedido está *en camino*:
{{items}}
📍 {{direccion}}
💰 Total a abonar: {{total}}
{{seguimiento}}
🔎 Seguí tu pedido: {{enlace}}
¡Ya casi llega!`,

  delivered: `¡Hola {{cliente}}! 🎉 Tu pedido fue *entregado*. ¡Que lo disfrutes!
Gracias por elegir {{negocio}}. Si te gustó, contanos 🙌`,

  cancelled: `Hola {{cliente}}, tu pedido del {{fecha}} fue *cancelado*.
Si fue un error o querés reprogramarlo, escribinos. ¡Gracias!`,
};

/**
 * Replace {{key}} with vars[key]. Unknown placeholders are left untouched so
 * typos are visible. Lines that become blank after substitution are removed,
 * and runs of blank lines are collapsed.
 */
export function renderTemplate(body: string, vars: Record<string, string>): string {
  const sub = (s: string) =>
    s.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key) => (key in vars ? vars[key] : match));

  const out: string[] = [];
  for (const line of body.split("\n")) {
    const rendered = sub(line).replace(/\s+$/, "");
    const hadContent = line.trim() !== "";
    // A line that had text/placeholders but resolved to empty is dropped
    // (e.g. an order with no tracking link).
    if (hadContent && rendered.trim() === "") continue;
    // Collapse runs of blank lines from the original template.
    if (rendered.trim() === "" && (out.length === 0 || out[out.length - 1].trim() === "")) {
      continue;
    }
    out.push(rendered);
  }
  return out.join("\n").trim();
}

export interface OrderForMessage {
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  customerNotes: string | null;
  trackingUrl: string | null;
  deliveryDate: string;
  status: OrderStatus;
  fulfillmentType: "delivery" | "pickup";
  paymentMethod: { name: string } | null;
  shippingMethod: { name: string } | null;
  slot: { label: string; startTime: string; endTime: string } | null;
  items: {
    quantity: number;
    product: { name: string; priceCents: number; category: string };
  }[];
}

/** Build the placeholder values for a given order. */
export function buildOrderVars(
  order: OrderForMessage,
  tiers: PricingTier[],
  opts?: { publicUrl?: string },
): Record<string, string> {
  const pricing = priceOrder(
    order.items.map((i) => ({
      product: { priceCents: i.product.priceCents, category: i.product.category },
      quantity: i.quantity,
    })),
    tiers,
  );
  const cantidad = order.items.reduce((s, i) => s + i.quantity, 0);
  const items = order.items.map((i) => `${i.quantity}× ${i.product.name}`).join(", ");
  const franja = order.slot
    ? `${trimTime(order.slot.startTime)}–${trimTime(order.slot.endTime)}`
    : "";

  return {
    cliente: order.customerName,
    telefono: order.customerPhone,
    direccion: order.customerAddress,
    fecha: formatLongDate(order.deliveryDate),
    franja,
    items,
    cantidad: String(cantidad),
    subtotal: formatArs(pricing.subtotalCents),
    descuento: formatArs(pricing.discountCents),
    total: formatArs(pricing.totalCents),
    estado: STATUS_LABELS[order.status],
    pago: order.paymentMethod?.name ?? "",
    envio:
      order.fulfillmentType === "pickup"
        ? "Retiro en el local"
        : (order.shippingMethod?.name ?? ""),
    notas: (order.customerNotes ?? "").trim(),
    seguimiento: (order.trackingUrl ?? "").trim(),
    enlace: opts?.publicUrl ?? "",
    negocio: APP_NAME_SHORT,
  };
}

/** Example values for the Settings live preview (no real order needed). */
export function sampleVars(): Record<string, string> {
  return {
    cliente: "Juan Pérez",
    telefono: "+54 9 381 555 1234",
    direccion: "Av. Mate de Luna 2214, San Miguel de Tucumán",
    fecha: "viernes, 26 de junio de 2026",
    franja: "21:00–22:00",
    items: "2× Caldo de Pollo, 1× Caldo de Carne",
    cantidad: "3",
    subtotal: "$ 37.000",
    descuento: "$ 2.312",
    total: "$ 34.688",
    estado: "Confirmado",
    pago: "Efectivo",
    envio: "Vehículo de Pablo",
    notas: "Sin cebolla",
    seguimiento: "https://maps.app.goo.gl/ejemplo",
    enlace: "https://cocaramen.vercel.app/p/ejemplo",
    negocio: APP_NAME_SHORT,
  };
}
