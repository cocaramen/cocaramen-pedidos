import { describe, it, expect } from "vitest";
import { computeOrderSnapshot, type CostingItem } from "@/lib/costing";
import type { PricingTier } from "@/lib/pricing";

const tiers: PricingTier[] = [{ category: "Ramen", minQuantity: 2, discountBps: 625 }];

const pollo = { priceCents: 1600000, costCents: 600000, category: "Ramen" };
const carne = { priceCents: 1800000, costCents: 700000, category: "Ramen" };

describe("computeOrderSnapshot", () => {
  it("freezes totals (from pricing) and COGS (sum of unit costs)", () => {
    const items: CostingItem[] = [
      { product: pollo, quantity: 2 },
      { product: carne, quantity: 1 },
    ];
    const s = computeOrderSnapshot(items, tiers);
    // 3 ramen → 6.25% off the subtotal
    expect(s.subtotalCents).toBe(1600000 * 2 + 1800000); // 5.000.000
    expect(s.discountCents).toBe(Math.round(5000000 * 0.0625)); // 312.500
    expect(s.totalCents).toBe(s.subtotalCents - s.discountCents);
    // COGS = 600000*2 + 700000 = 1.900.000 (discount does NOT touch cost)
    expect(s.goodsCostCents).toBe(600000 * 2 + 700000);
  });

  it("freezes per-line price/cost/category and skips zero-qty", () => {
    const s = computeOrderSnapshot(
      [
        { product: pollo, quantity: 0 },
        { product: carne, quantity: 3 },
      ],
      [],
    );
    expect(s.lines).toHaveLength(1);
    expect(s.lines[0]).toMatchObject({
      quantity: 3,
      unitPriceCents: 1800000,
      unitCostCents: 700000,
      lineCategory: "Ramen",
    });
    expect(s.goodsCostCents).toBe(700000 * 3);
  });

  it("handles a zero-cost product (margin = full price) without error", () => {
    const s = computeOrderSnapshot(
      [{ product: { priceCents: 1000000, costCents: 0, category: "Ramen" }, quantity: 1 }],
      [],
    );
    expect(s.goodsCostCents).toBe(0);
    expect(s.totalCents).toBe(1000000);
  });
});
