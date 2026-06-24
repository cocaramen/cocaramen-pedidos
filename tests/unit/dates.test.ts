import { describe, it, expect } from "vitest";
import {
  weekdayKey,
  isActiveDeliveryDay,
  nextDeliveryDate,
  trimTime,
} from "@/lib/dates";

describe("weekdayKey", () => {
  it("maps known dates to weekday keys", () => {
    // 2026-06-26 is a Friday
    expect(weekdayKey("2026-06-26")).toBe("friday");
    // 2026-06-22 is a Monday
    expect(weekdayKey("2026-06-22")).toBe("monday");
  });
});

describe("isActiveDeliveryDay", () => {
  it("respects the configured active days", () => {
    expect(isActiveDeliveryDay("2026-06-26", ["friday"])).toBe(true);
    expect(isActiveDeliveryDay("2026-06-25", ["friday"])).toBe(false);
    expect(isActiveDeliveryDay("2026-06-25", ["thursday", "friday"])).toBe(true);
  });
});

describe("nextDeliveryDate", () => {
  it("returns today when today is an active day", () => {
    const friday = new Date("2026-06-26T10:00:00");
    expect(nextDeliveryDate(["friday"], friday)).toBe("2026-06-26");
  });

  it("returns the next active day in the future", () => {
    const monday = new Date("2026-06-22T10:00:00");
    expect(nextDeliveryDate(["friday"], monday)).toBe("2026-06-26");
  });

  it("falls back to today when no active days", () => {
    const monday = new Date("2026-06-22T10:00:00");
    expect(nextDeliveryDate([], monday)).toBe("2026-06-22");
  });
});

describe("trimTime", () => {
  it("trims seconds", () => {
    expect(trimTime("21:00:00")).toBe("21:00");
  });
});
