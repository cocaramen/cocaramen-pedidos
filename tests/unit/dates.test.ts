import { describe, it, expect } from "vitest";
import { workingDayEnd, isPublicLinkExpired, upcomingDeliveryDates } from "@/lib/dates";

describe("upcomingDeliveryDates", () => {
  it("lists the next N matching weekdays including today", () => {
    const thu = new Date(2026, 5, 25, 12); // Thu 2026-06-25 (local)
    const r = upcomingDeliveryDates(["friday"], 3, thu);
    expect(r).toEqual(["2026-06-26", "2026-07-03", "2026-07-10"]);
  });

  it("includes today when it is a delivery day", () => {
    const fri = new Date(2026, 5, 26, 12); // Fri 2026-06-26 (local)
    const r = upcomingDeliveryDates(["friday"], 1, fri);
    expect(r).toEqual(["2026-06-26"]);
  });

  it("returns nothing when no active days", () => {
    expect(upcomingDeliveryDates([], 3, new Date(2026, 5, 25, 12))).toEqual([]);
  });
});

const NIGHT_SLOTS = [
  { endTime: "22:00:00" },
  { endTime: "23:00:00" },
  { endTime: "00:00:00" },
  { endTime: "01:00:00" },
];

describe("workingDayEnd", () => {
  it("ends late-night ops at 01:00 the following day (AR time)", () => {
    // Fri 2026-06-26 night → Sat 2026-06-27 01:00 AR = 04:00 UTC
    expect(workingDayEnd("2026-06-26", NIGHT_SLOTS).toISOString()).toBe(
      "2026-06-27T04:00:00.000Z",
    );
  });

  it("ends a daytime slot the same day", () => {
    // 13:00 AR = 16:00 UTC, same day
    expect(workingDayEnd("2026-06-26", [{ endTime: "13:00:00" }]).toISOString()).toBe(
      "2026-06-26T16:00:00.000Z",
    );
  });
});

describe("isPublicLinkExpired", () => {
  it("is not expired before the working day ends", () => {
    const now = new Date("2026-06-27T03:59:00.000Z"); // 00:59 AR Sat
    expect(isPublicLinkExpired("2026-06-26", NIGHT_SLOTS, now)).toBe(false);
  });

  it("is expired after the working day ends", () => {
    const now = new Date("2026-06-27T04:30:00.000Z"); // 01:30 AR Sat
    expect(isPublicLinkExpired("2026-06-26", NIGHT_SLOTS, now)).toBe(true);
  });
});

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
