import { describe, it, expect } from "vitest";
import { priceOrder, bestTierBps, type PricingTier } from "@/lib/pricing";

const RAMEN = { priceCents: 1600000, category: "Ramen" }; // $16.000
const tiers: PricingTier[] = [
  { category: "Ramen", minQuantity: 2, discountBps: 625 }, // 6.25%
  { category: "Ramen", minQuantity: 4, discountBps: 940 }, // 9.4%
];

describe("bestTierBps", () => {
  it("returns 0 below the first threshold", () => {
    expect(bestTierBps(tiers, "Ramen", 1)).toBe(0);
  });
  it("applies the 2+ tier for 2 or 3 units", () => {
    expect(bestTierBps(tiers, "Ramen", 2)).toBe(625);
    expect(bestTierBps(tiers, "Ramen", 3)).toBe(625);
  });
  it("applies the 4+ tier from 4 units", () => {
    expect(bestTierBps(tiers, "Ramen", 4)).toBe(940);
    expect(bestTierBps(tiers, "Ramen", 10)).toBe(940);
  });
  it("ignores other categories and inactive tiers", () => {
    expect(bestTierBps(tiers, "Bebida", 5)).toBe(0);
    expect(
      bestTierBps([{ category: "Ramen", minQuantity: 2, discountBps: 625, isActive: false }], "Ramen", 5),
    ).toBe(0);
  });
});

describe("priceOrder", () => {
  it("charges full price for a single bowl", () => {
    const r = priceOrder([{ product: RAMEN, quantity: 1 }], tiers);
    expect(r.subtotalCents).toBe(1600000);
    expect(r.discountCents).toBe(0);
    expect(r.totalCents).toBe(1600000);
  });

  it("applies the 2-bowl discount across MIXED flavors of the same category", () => {
    const r = priceOrder(
      [
        { product: { priceCents: 1600000, category: "Ramen" }, quantity: 1 },
        { product: { priceCents: 1600000, category: "Ramen" }, quantity: 1 },
      ],
      tiers,
    );
    // 2 × 16.000 = 32.000 − 6.25% = 30.000
    expect(r.subtotalCents).toBe(3200000);
    expect(r.discountCents).toBe(200000);
    expect(r.totalCents).toBe(3000000);
  });

  it("uses the higher tier at 4 bowls", () => {
    const r = priceOrder([{ product: RAMEN, quantity: 4 }], tiers);
    // 4 × 16.000 = 64.000 − 9.4% = 57.984
    expect(r.subtotalCents).toBe(6400000);
    expect(r.discountCents).toBe(601600);
    expect(r.totalCents).toBe(5798400);
  });

  it("prices categories independently (a drink does not trigger the ramen offer)", () => {
    const r = priceOrder(
      [
        { product: { priceCents: 1600000, category: "Ramen" }, quantity: 1 },
        { product: { priceCents: 300000, category: "Bebida" }, quantity: 1 },
      ],
      tiers,
    );
    expect(r.discountCents).toBe(0);
    expect(r.totalCents).toBe(1900000);
    expect(r.categories).toHaveLength(2);
  });

  it("ignores zero-quantity items", () => {
    const r = priceOrder(
      [
        { product: RAMEN, quantity: 0 },
        { product: RAMEN, quantity: 2 },
      ],
      tiers,
    );
    expect(r.categories[0].quantity).toBe(2);
  });
});
