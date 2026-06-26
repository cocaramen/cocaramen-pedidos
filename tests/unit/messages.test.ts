import { describe, it, expect } from "vitest";
import { renderTemplate, buildOrderVars, type OrderForMessage } from "@/lib/messages";
import { waMeLink, normalizePhone } from "@/lib/whatsapp";
import type { PricingTier } from "@/lib/pricing";

describe("renderTemplate", () => {
  it("replaces known placeholders", () => {
    expect(renderTemplate("Hola {{cliente}}", { cliente: "Juan" })).toBe("Hola Juan");
  });

  it("leaves unknown placeholders untouched", () => {
    expect(renderTemplate("Hola {{desconocido}}", { cliente: "Juan" })).toBe(
      "Hola {{desconocido}}",
    );
  });

  it("drops a line that becomes blank (e.g. empty tracking link)", () => {
    const body = "Línea 1\n{{seguimiento}}\nLínea 3";
    expect(renderTemplate(body, { seguimiento: "" })).toBe("Línea 1\nLínea 3");
  });

  it("keeps the line when the placeholder has a value", () => {
    const body = "Línea 1\n{{seguimiento}}\nLínea 3";
    expect(renderTemplate(body, { seguimiento: "http://x" })).toBe(
      "Línea 1\nhttp://x\nLínea 3",
    );
  });
});

const tiers: PricingTier[] = [{ category: "Ramen", minQuantity: 2, discountBps: 625 }];

const order: OrderForMessage = {
  customerName: "Juan",
  customerPhone: "+54 9 381 555 1234",
  customerAddress: "Calle 1",
  customerNotes: null,
  trackingUrl: null,
  deliveryDate: "2026-06-26",
  status: "confirmed",
  fulfillmentType: "delivery",
  paymentMethod: { name: "Efectivo" },
  shippingMethod: { name: "Vehículo de Pablo" },
  slot: { label: "21:00 - 22:00", startTime: "21:00:00", endTime: "22:00:00" },
  items: [
    { quantity: 2, product: { name: "Caldo de Pollo", priceCents: 1600000, category: "Ramen" } },
  ],
};

describe("buildOrderVars", () => {
  it("fills item detail, quantity and pricing with the volume discount", () => {
    const v = buildOrderVars(order, tiers);
    expect(v.cliente).toBe("Juan");
    expect(v.items).toBe("2× Caldo de Pollo");
    expect(v.cantidad).toBe("2");
    expect(v.estado).toBe("Confirmado");
    expect(v.franja).toBe("21:00–22:00");
    // 2 × 16.000 = 32.000 − 6.25% = 30.000
    expect(v.total).toContain("30.000");
    expect(v.seguimiento).toBe("");
    expect(v.pago).toBe("Efectivo");
    expect(v.envio).toBe("Vehículo de Pablo");
  });

  it("shows pickup label and no shipping method for pickup orders", () => {
    const v = buildOrderVars({ ...order, fulfillmentType: "pickup", shippingMethod: null }, tiers);
    expect(v.envio).toBe("Retiro en el local");
  });
});

describe("waMeLink", () => {
  it("strips non-digits from the phone", () => {
    expect(normalizePhone("+54 9 381 555-1234")).toBe("5493815551234");
  });

  it("builds an encoded wa.me link", () => {
    const link = waMeLink("+54 9 381 555 1234", "Hola Juan");
    expect(link).toBe("https://wa.me/5493815551234?text=Hola%20Juan");
  });

  it("returns null when the phone has too few digits", () => {
    expect(waMeLink("12", "x")).toBeNull();
  });
});
