import { describe, it, expect } from "vitest";
import {
  canTransition,
  isValidStatus,
  ORDER_STATUSES,
  STATUS_LABELS,
} from "@/lib/order-status";

describe("order status state machine", () => {
  it("allows the happy-path forward transitions", () => {
    expect(canTransition("pending", "confirmed")).toBe(true);
    expect(canTransition("confirmed", "preparing")).toBe(true);
    expect(canTransition("preparing", "out_for_delivery")).toBe(true);
    expect(canTransition("out_for_delivery", "delivered")).toBe(true);
  });

  it("allows cancelling any non-terminal order", () => {
    expect(canTransition("pending", "cancelled")).toBe(true);
    expect(canTransition("preparing", "cancelled")).toBe(true);
    expect(canTransition("out_for_delivery", "cancelled")).toBe(true);
  });

  it("treats same-status as a no-op success", () => {
    expect(canTransition("delivered", "delivered")).toBe(true);
  });

  it("rejects illegal jumps", () => {
    expect(canTransition("pending", "delivered")).toBe(false);
    expect(canTransition("delivered", "pending")).toBe(false);
    expect(canTransition("cancelled", "delivered")).toBe(false);
  });

  it("allows reopening a cancelled order to pending", () => {
    expect(canTransition("cancelled", "pending")).toBe(true);
  });

  it("validates status strings", () => {
    expect(isValidStatus("pending")).toBe(true);
    expect(isValidStatus("nope")).toBe(false);
  });

  it("has a Spanish label for every status", () => {
    for (const s of ORDER_STATUSES) {
      expect(STATUS_LABELS[s]).toBeTruthy();
    }
  });
});
