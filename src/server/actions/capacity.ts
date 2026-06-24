"use server";

import { evaluateCapacity, type CapacityEvaluation } from "@/lib/capacity";
import { buildCapacitySnapshot } from "@/server/capacity-service";
import { requireUser } from "@/lib/auth/session";

/**
 * Authoritative live capacity preview used by the order form. The client
 * may render an optimistic preview, but this is the source of truth.
 */
export async function previewCapacity(input: {
  date: string;
  slotId: string;
  bowls: number;
  excludeOrderId?: string;
}): Promise<CapacityEvaluation | null> {
  await requireUser();
  if (!input.date || !input.slotId) return null;

  const snapshot = await buildCapacitySnapshot({
    date: input.date,
    slotId: input.slotId,
    excludeOrderId: input.excludeOrderId,
  });
  return evaluateCapacity(snapshot, Math.max(0, input.bowls || 0));
}
