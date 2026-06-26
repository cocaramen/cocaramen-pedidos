import { describe, it, expect } from "vitest";
import { createOrderSchema, deliverySlotSchema, publicOrderSchema } from "@/lib/validation";

const validOrder = {
  customerName: "Juan Pérez",
  customerPhone: "+34 600 123 456",
  customerAddress: "Calle Mayor 1, Madrid",
  deliveryDate: "2026-06-26",
  deliverySlotId: "11111111-1111-1111-1111-111111111111",
  items: [{ productId: "22222222-2222-2222-2222-222222222222", quantity: 2 }],
};

describe("createOrderSchema", () => {
  it("accepts a valid order", () => {
    const r = createOrderSchema.safeParse(validOrder);
    expect(r.success).toBe(true);
  });

  it("requires a customer name", () => {
    const r = createOrderSchema.safeParse({ ...validOrder, customerName: "" });
    expect(r.success).toBe(false);
  });

  it("requires at least one item", () => {
    const r = createOrderSchema.safeParse({ ...validOrder, items: [] });
    expect(r.success).toBe(false);
  });

  it("rejects duplicate products", () => {
    const r = createOrderSchema.safeParse({
      ...validOrder,
      items: [
        { productId: "22222222-2222-2222-2222-222222222222", quantity: 1 },
        { productId: "22222222-2222-2222-2222-222222222222", quantity: 1 },
      ],
    });
    expect(r.success).toBe(false);
  });

  it("requires an address for delivery orders", () => {
    const r = createOrderSchema.safeParse({
      ...validOrder,
      fulfillmentType: "delivery",
      customerAddress: "",
    });
    expect(r.success).toBe(false);
  });

  it("allows an empty address for pickup orders", () => {
    const r = createOrderSchema.safeParse({
      ...validOrder,
      fulfillmentType: "pickup",
      customerAddress: "",
    });
    expect(r.success).toBe(true);
  });

  it("rejects an invalid date format", () => {
    const r = createOrderSchema.safeParse({ ...validOrder, deliveryDate: "26/06/2026" });
    expect(r.success).toBe(false);
  });

  it("rejects quantity below 1", () => {
    const r = createOrderSchema.safeParse({
      ...validOrder,
      items: [{ productId: "22222222-2222-2222-2222-222222222222", quantity: 0 }],
    });
    expect(r.success).toBe(false);
  });
});

describe("publicOrderSchema", () => {
  const validPublic = {
    customerName: "Juan",
    customerPhone: "+54 9 381 555 1234",
    customerAddress: "Calle 1",
    fulfillmentType: "delivery",
    paymentMethodId: "11111111-1111-1111-1111-111111111111",
    deliveryDate: "2026-06-26",
    deliverySlotId: "22222222-2222-2222-2222-222222222222",
    items: [{ productId: "33333333-3333-3333-3333-333333333333", quantity: 2 }],
  };

  it("accepts a valid delivery order", () => {
    expect(publicOrderSchema.safeParse(validPublic).success).toBe(true);
  });

  it("rejects when the honeypot is filled", () => {
    expect(
      publicOrderSchema.safeParse({ ...validPublic, website: "http://spam" }).success,
    ).toBe(false);
  });

  it("requires an address for delivery but not for pickup", () => {
    expect(
      publicOrderSchema.safeParse({ ...validPublic, customerAddress: "" }).success,
    ).toBe(false);
    expect(
      publicOrderSchema.safeParse({
        ...validPublic,
        fulfillmentType: "pickup",
        customerAddress: "",
      }).success,
    ).toBe(true);
  });

  it("requires a payment method", () => {
    const { paymentMethodId: _omit, ...noPay } = validPublic;
    expect(publicOrderSchema.safeParse(noPay).success).toBe(false);
  });
});

describe("deliverySlotSchema", () => {
  it("accepts HH:MM and HH:MM:SS times", () => {
    expect(
      deliverySlotSchema.safeParse({
        label: "21:00 - 22:00",
        startTime: "21:00",
        endTime: "22:00:00",
        capacityLimit: 6,
      }).success,
    ).toBe(true);
  });

  it("rejects malformed times", () => {
    expect(
      deliverySlotSchema.safeParse({
        label: "bad",
        startTime: "9pm",
        endTime: "22:00",
        capacityLimit: 6,
      }).success,
    ).toBe(false);
  });
});
