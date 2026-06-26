// Pure order-pricing engine. No DB / I/O so it can be unit-tested and reused
// on both client (live preview) and server (authoritative). All money is in
// ARS centavos (integers); discounts are basis points (625 = 6.25%).

export interface PricingProduct {
  priceCents: number;
  category: string;
}

export interface PricingItem {
  product: PricingProduct;
  quantity: number;
}

export interface PricingTier {
  category: string;
  minQuantity: number;
  discountBps: number;
  isActive?: boolean;
}

export interface CategoryBreakdown {
  category: string;
  quantity: number;
  subtotalCents: number;
  /** Basis points of the applied tier (0 if none qualifies). */
  discountBps: number;
  discountCents: number;
  totalCents: number;
}

export interface OrderPricing {
  categories: CategoryBreakdown[];
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
}

/**
 * Find the best volume discount the given quantity qualifies for in a category.
 * "Best" = highest discount among tiers whose threshold is reached (so the
 * customer always gets the cheapest valid price), tie-broken by higher minQty.
 */
export function bestTierBps(
  tiers: PricingTier[],
  category: string,
  quantity: number,
): number {
  let best = 0;
  let bestMin = 0;
  for (const t of tiers) {
    if (t.isActive === false) continue;
    if (t.category !== category) continue;
    if (quantity < t.minQuantity) continue;
    if (t.discountBps > best || (t.discountBps === best && t.minQuantity > bestMin)) {
      best = t.discountBps;
      bestMin = t.minQuantity;
    }
  }
  return best;
}

/**
 * Price an order: group items by category, sum each category's subtotal and
 * quantity, apply the best qualifying volume discount per category, and total.
 */
export function priceOrder(items: PricingItem[], tiers: PricingTier[]): OrderPricing {
  const byCategory = new Map<string, { quantity: number; subtotalCents: number }>();

  for (const { product, quantity } of items) {
    if (quantity <= 0) continue;
    const acc = byCategory.get(product.category) ?? { quantity: 0, subtotalCents: 0 };
    acc.quantity += quantity;
    acc.subtotalCents += product.priceCents * quantity;
    byCategory.set(product.category, acc);
  }

  const categories: CategoryBreakdown[] = [];
  let subtotalCents = 0;
  let discountCents = 0;

  for (const [category, { quantity, subtotalCents: catSubtotal }] of byCategory) {
    const discountBps = bestTierBps(tiers, category, quantity);
    const catDiscount = Math.round((catSubtotal * discountBps) / 10000);
    categories.push({
      category,
      quantity,
      subtotalCents: catSubtotal,
      discountBps,
      discountCents: catDiscount,
      totalCents: catSubtotal - catDiscount,
    });
    subtotalCents += catSubtotal;
    discountCents += catDiscount;
  }

  // Stable order for display.
  categories.sort((a, b) => a.category.localeCompare(b.category));

  return {
    categories,
    subtotalCents,
    discountCents,
    totalCents: subtotalCents - discountCents,
  };
}
