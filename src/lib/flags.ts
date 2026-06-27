// Feature flags. Reads an env override when present, otherwise the default.
//
// RECEIPTS_ENABLED: módulo de comprobantes de transferencia (subida + vista en
// el detalle del pedido). Lo dejamos OFF temporalmente para diagnosticar si es
// la causa de la lentitud/cuelgue al reentrar a un pedido después de guardarlo.
// Para reactivar: poner el default en true (o setear RECEIPTS_ENABLED=true en
// las env de Vercel) y redeploy.
export const RECEIPTS_ENABLED = process.env.RECEIPTS_ENABLED
  ? process.env.RECEIPTS_ENABLED === "true"
  : false;
