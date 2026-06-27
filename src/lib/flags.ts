// Feature flags. Reads an env override when present, otherwise the default.
//
// RECEIPTS_ENABLED: módulo de comprobantes de transferencia. Se descartó como
// causa del cuelgue (seguía pasando con esto OFF), así que vuelve ON. La URL
// firmada de Storage se resuelve on-demand en el cliente, fuera del render.
// Para apagarlo: setear RECEIPTS_ENABLED=false en las env de Vercel.
export const RECEIPTS_ENABLED = process.env.RECEIPTS_ENABLED
  ? process.env.RECEIPTS_ENABLED === "true"
  : true;
