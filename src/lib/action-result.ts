import type { CapacityEvaluation } from "./capacity";

export type ActionResult<T = undefined> =
  | { ok: true; data: T; capacity?: CapacityEvaluation }
  | {
      ok: false;
      error: string;
      fieldErrors?: Record<string, string[]>;
      /** When set, the operation was blocked only by a soft capacity limit. */
      needsApproval?: boolean;
      capacity?: CapacityEvaluation;
    };

export function ok<T>(data: T, capacity?: CapacityEvaluation): ActionResult<T> {
  return { ok: true, data, capacity };
}

export function fail(error: string, extra?: Omit<Extract<ActionResult, { ok: false }>, "ok" | "error">): ActionResult<never> {
  return { ok: false, error, ...extra };
}
