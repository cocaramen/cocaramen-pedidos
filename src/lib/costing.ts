// Pure order financial snapshot — frozen onto orders/order_items at sale time
// so historical reports never drift when prices, costs or discounts change.
// Money in ARS centavos. Reuses the pricing engine for price/discount/total
// and adds COGS (sum of product unit costs). No DB / I/O.

import { priceOrder, type PricingTier } from "@/lib/pricing";

export interface CostingProduct {
  priceCents: number;
  costCents: number;
  category: string;
}

export interface CostingItem {
  product: CostingProduct;
  quantity: number;
}

export interface OrderSnapshotLine {
  quantity: number;
  unitPriceCents: number;
  unitCostCents: number;
  lineCategory: string;
}

export interface OrderSnapshot {
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  /** COGS of the whole order = Σ unitCost × qty. */
  goodsCostCents: number;
  lines: OrderSnapshotLine[];
}

/**
 * Compute the frozen financial snapshot for an order. `items` carry the product
 * price/cost/category to freeze. Price + discount + total come from priceOrder()
 * (single source of truth for pricing); COGS is summed independently.
 */
export function computeOrderSnapshot(
  items: CostingItem[],
  tiers: PricingTier[],
): OrderSnapshot {
  const pricing = priceOrder(
    items.map((i) => ({
      product: { priceCents: i.product.priceCents, category: i.product.category },
      quantity: i.quantity,
    })),
    tiers,
  );

  let goodsCostCents = 0;
  const lines: OrderSnapshotLine[] = items
    .filter((i) => i.quantity > 0)
    .map((i) => {
      goodsCostCents += i.product.costCents * i.quantity;
      return {
        quantity: i.quantity,
        unitPriceCents: i.product.priceCents,
        unitCostCents: i.product.costCents,
        lineCategory: i.product.category,
      };
    });

  return {
    subtotalCents: pricing.subtotalCents,
    discountCents: pricing.discountCents,
    totalCents: pricing.totalCents,
    goodsCostCents,
    lines,
  };
}
