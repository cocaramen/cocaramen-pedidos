import { notFound } from "next/navigation";
import {
  getOrderByPublicToken,
  getActiveSlots,
  getActiveVolumeDiscounts,
} from "@/server/queries";
import { getBranding } from "@/server/settings";
import { priceOrder } from "@/lib/pricing";
import { formatArs } from "@/lib/money";
import { formatLongDate, trimTime, isPublicLinkExpired } from "@/lib/dates";
import { STATUS_LABELS, STATUS_BADGE_CLASSES } from "@/lib/order-status";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

function Shell({
  branding,
  children,
}: {
  branding: { name: string; logo: string | null };
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-muted/40 px-4 py-8">
      <div className="mx-auto w-full max-w-lg space-y-4">
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="relative h-16 w-16 overflow-hidden rounded-full shadow-md">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={branding.logo ?? "/logo.png"}
              alt={branding.name}
              className="h-full w-full object-cover"
            />
          </span>
          <span className="text-lg font-bold">{branding.name}</span>
        </div>
        {children}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

export default async function PublicOrderPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const order = await getOrderByPublicToken(token);
  if (!order) notFound();

  const [slots, discounts, branding] = await Promise.all([
    getActiveSlots(),
    getActiveVolumeDiscounts(),
    getBranding(),
  ]);

  if (isPublicLinkExpired(order.deliveryDate, slots)) {
    return (
      <Shell branding={branding}>
        <div className="rounded-xl border bg-card p-8 text-center">
          <p className="text-4xl">⌛</p>
          <h1 className="mt-3 text-lg font-semibold">Este enlace venció</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            El detalle de este pedido ya no está disponible. Si necesitás algo,
            escribinos.
          </p>
        </div>
      </Shell>
    );
  }

  const pricing = priceOrder(
    order.items.map((i) => ({
      product: { priceCents: i.product.priceCents, category: i.product.category },
      quantity: i.quantity,
    })),
    discounts,
  );
  const isPickup = order.fulfillmentType === "pickup";
  const cancelled = order.status === "cancelled";
  const delivered = order.status === "delivered";
  const inVerification =
    !cancelled &&
    !delivered &&
    !order.overCapacityApproved &&
    (order.exceededSlotCapacity || order.exceededDailyCapacity);

  return (
    <Shell branding={branding}>
      {cancelled && (
        <div className="rounded-xl border-2 border-rose-300 bg-rose-600 p-5 text-center text-white shadow-sm">
          <p className="text-3xl">✕</p>
          <p className="mt-1 text-lg font-bold">Pedido cancelado</p>
          <p className="mt-1 text-sm text-rose-50">
            Este pedido fue cancelado. Si creés que es un error, escribinos.
          </p>
        </div>
      )}
      {delivered && (
        <div className="rounded-xl border-2 border-emerald-300 bg-emerald-600 p-5 text-center text-white shadow-sm">
          <p className="text-3xl">🎉</p>
          <p className="mt-1 text-lg font-bold">¡Pedido entregado!</p>
          <p className="mt-1 text-sm text-emerald-50">
            ¡Gracias por tu compra! Esperamos que lo disfrutes.
          </p>
        </div>
      )}
      {inVerification && (
        <div className="rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm text-warning-foreground">
          <p className="font-medium">Tu pedido está en verificación ⏳</p>
          <p className="mt-1">
            El horario elegido estaba completo. Estamos confirmando disponibilidad y
            te avisamos por WhatsApp. Esta página se actualiza con el estado.
          </p>
        </div>
      )}
      <div
        className={cn(
          "overflow-hidden rounded-xl border bg-card shadow-sm",
          cancelled && "border-rose-300 opacity-90",
          delivered && "border-emerald-300",
        )}
      >
        {/* Status banner */}
        <div
          className={cn(
            "flex items-center justify-between gap-3 border-b px-5 py-4",
            cancelled ? "bg-rose-50" : delivered ? "bg-emerald-50" : "bg-muted/30",
          )}
        >
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Tu pedido
            </p>
            <p className="text-base font-semibold">{order.customerName}</p>
          </div>
          <span
            className={cn(
              "rounded-full border px-3 py-1 text-sm font-medium",
              STATUS_BADGE_CLASSES[order.status],
            )}
          >
            {STATUS_LABELS[order.status]}
          </span>
        </div>

        {/* Items */}
        <div className="border-b px-5 py-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Detalle
          </p>
          <ul className="space-y-1.5">
            {order.items.map((i) => (
              <li key={i.id} className="flex items-center justify-between text-sm">
                <span>
                  <span className="font-medium tabular-nums">{i.quantity}×</span>{" "}
                  {i.product.name}
                </span>
                <span className="tabular-nums text-muted-foreground">
                  {formatArs(i.product.priceCents * i.quantity)}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Delivery / payment details */}
        <div className="border-b px-5 py-2">
          <Row
            label="Entrega"
            value={isPickup ? "Retiro en el local" : "Envío a domicilio"}
          />
          {!isPickup && <Row label="Dirección" value={order.customerAddress} />}
          {!isPickup && order.shippingMethod && (
            <Row label="Se envía en" value={order.shippingMethod.name} />
          )}
          <Row
            label="Fecha"
            value={
              <span className="capitalize">{formatLongDate(order.deliveryDate)}</span>
            }
          />
          {order.slot && (
            <Row
              label="Franja"
              value={`${trimTime(order.slot.startTime)} – ${trimTime(order.slot.endTime)}`}
            />
          )}
          {order.paymentMethod && <Row label="Pago" value={order.paymentMethod.name} />}
          {order.customerNotes && <Row label="Notas" value={order.customerNotes} />}
        </div>

        {/* Totals */}
        <div className="px-5 py-4">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Subtotal</span>
            <span className="tabular-nums">{formatArs(pricing.subtotalCents)}</span>
          </div>
          {pricing.discountCents > 0 && (
            <div className="flex items-center justify-between text-sm text-success">
              <span>Descuento</span>
              <span className="tabular-nums">−{formatArs(pricing.discountCents)}</span>
            </div>
          )}
          <div className="mt-1 flex items-baseline justify-between border-t pt-2">
            <span className="font-semibold">Total</span>
            <span className="text-xl font-bold tabular-nums">
              {formatArs(pricing.totalCents)}
            </span>
          </div>
        </div>

        {!isPickup && order.trackingUrl && (
          <div className="border-t px-5 py-4">
            <a
              href={order.trackingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Seguir mi pedido
            </a>
          </div>
        )}
      </div>

      <p className="px-2 text-center text-xs text-muted-foreground">
        Esta página muestra el estado actual de tu pedido y se actualiza
        automáticamente. ¡Gracias por elegir {branding.name}!
      </p>
    </Shell>
  );
}
