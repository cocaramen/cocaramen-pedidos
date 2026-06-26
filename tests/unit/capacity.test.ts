import { describe, it, expect } from "vitest";
import {
  evaluateCapacity,
  sumBowls,
  utilizationPct,
  type CapacitySnapshot,
} from "@/lib/capacity";

const base: CapacitySnapshot = {
  slotBowls: 0,
  dailyBowls: 0,
  slotCapacity: 6,
  dailyCapacity: 24,
};

describe("sumBowls", () => {
  it("sums quantities", () => {
    expect(sumBowls([{ quantity: 2 }, { quantity: 3 }])).toBe(5);
  });
  it("ignores negatives and empties", () => {
    expect(sumBowls([{ quantity: -2 }, { quantity: 3 }])).toBe(3);
    expect(sumBowls([])).toBe(0);
  });
});

describe("utilizationPct", () => {
  it("computes percentage", () => {
    expect(utilizationPct(3, 6)).toBe(50);
    expect(utilizationPct(9, 6)).toBe(150);
  });
  it("handles zero capacity", () => {
    expect(utilizationPct(0, 0)).toBe(0);
    expect(utilizationPct(2, 0)).toBe(100);
  });
});

describe("evaluateCapacity — within limits", () => {
  it("does not require approval when within both limits", () => {
    const e = evaluateCapacity({ ...base, slotBowls: 3 }, 2);
    expect(e.newSlotTotal).toBe(5);
    expect(e.newDailyTotal).toBe(2);
    expect(e.exceededSlotCapacity).toBe(false);
    expect(e.exceededDailyCapacity).toBe(false);
    expect(e.requiresApproval).toBe(false);
    expect(e.slotWarning).toBeUndefined();
    expect(e.slotRemaining).toBe(1);
  });

  it("treats exactly-at-limit as NOT exceeded", () => {
    const e = evaluateCapacity({ ...base, slotBowls: 4 }, 2);
    expect(e.newSlotTotal).toBe(6);
    expect(e.exceededSlotCapacity).toBe(false);
    expect(e.slotRemaining).toBe(0);
  });
});

describe("evaluateCapacity — slot exceeded (the spec example)", () => {
  it("6 existing + 3 new => warning to 9, requires approval", () => {
    const e = evaluateCapacity({ ...base, slotBowls: 6, dailyBowls: 6 }, 3);
    expect(e.newSlotTotal).toBe(9);
    expect(e.exceededSlotCapacity).toBe(true);
    expect(e.requiresApproval).toBe(true);
    expect(e.slotRemaining).toBe(-3);
    expect(e.slotWarning).toContain("6");
    expect(e.slotWarning).toContain("9");
  });
});

describe("evaluateCapacity — daily exceeded", () => {
  it("flags daily over-capacity independently of slot", () => {
    const e = evaluateCapacity(
      { slotBowls: 0, dailyBowls: 23, slotCapacity: 6, dailyCapacity: 24 },
      2,
    );
    expect(e.exceededSlotCapacity).toBe(false);
    expect(e.exceededDailyCapacity).toBe(true);
    expect(e.requiresApproval).toBe(true);
    expect(e.dailyWarning).toContain("24");
  });
});

describe("evaluateCapacity — soft limits never block", () => {
  it("always returns an evaluation (no throw) even far over capacity", () => {
    const e = evaluateCapacity({ ...base, slotBowls: 100, dailyBowls: 100 }, 50);
    expect(e.requiresApproval).toBe(true);
    expect(e.newSlotTotal).toBe(150);
  });
});

describe("evaluateCapacity — hard ceilings", () => {
  it("does not hard-block when no max is set (0 = disabled)", () => {
    const e = evaluateCapacity({ ...base, slotBowls: 100 }, 500);
    expect(e.requiresApproval).toBe(true);
    expect(e.hardBlocked).toBe(false);
  });

  it("allows soft-over-capacity but under the hard ceiling (verification zone)", () => {
    const e = evaluateCapacity(
      { ...base, slotBowls: 5, slotMaxCapacity: 10, dailyMaxCapacity: 40 },
      3, // → 8: over soft 6, under hard 10
    );
    expect(e.exceededSlotCapacity).toBe(true);
    expect(e.requiresApproval).toBe(true);
    expect(e.hardBlocked).toBe(false);
  });

  it("hard-blocks when the slot hard ceiling is exceeded", () => {
    const e = evaluateCapacity(
      { ...base, slotBowls: 5, slotMaxCapacity: 10, dailyMaxCapacity: 40 },
      6, // → 11 > 10
    );
    expect(e.exceededSlotMax).toBe(true);
    expect(e.hardBlocked).toBe(true);
    expect(e.hardWarning).toContain("10");
  });

  it("hard-blocks when the daily hard ceiling is exceeded", () => {
    const e = evaluateCapacity(
      { slotBowls: 0, dailyBowls: 38, slotCapacity: 6, dailyCapacity: 24, slotMaxCapacity: 12, dailyMaxCapacity: 40 },
      5, // daily → 43 > 40
    );
    expect(e.exceededDailyMax).toBe(true);
    expect(e.hardBlocked).toBe(true);
  });
});
