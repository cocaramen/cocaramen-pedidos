// Argentine peso (ARS) money helpers. Amounts are stored as integer centavos
// (minor units) to avoid floating-point rounding; the UI works in pesos.

const arsFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/** Format integer centavos as an ARS string, e.g. 1250000 → "$ 12.500". */
export function formatArs(cents: number): string {
  return arsFormatter.format((cents ?? 0) / 100);
}

/**
 * Parse a pesos string typed by the operator into integer centavos.
 * Accepts "12000", "12.000", "12000,50", "$ 12.500,50". Returns null if the
 * input is not a valid non-negative amount.
 */
export function pesosToCents(input: string): number | null {
  const trimmed = (input ?? "").trim();
  if (trimmed === "") return null;
  // Strip currency symbols/spaces, drop thousands dots, use dot as decimal sep.
  const normalized = trimmed
    .replace(/[^\d.,-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const pesos = Number(normalized);
  if (!Number.isFinite(pesos) || pesos < 0) return null;
  return Math.round(pesos * 100);
}

/** Convert integer centavos to a plain pesos string for editing, e.g. 1250000 → "12500". */
export function centsToPesosInput(cents: number): string {
  if (!cents) return "0";
  const pesos = cents / 100;
  return Number.isInteger(pesos) ? String(pesos) : pesos.toFixed(2);
}
