import { describe, it, expect } from "vitest";
import { createOrderSchema, deliverySlotSchema } from "@/lib/validation";

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
