"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Minus, Plus, Loader2, AlertTriangle } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { priceOrder, type PricingTier, type PricingItem } from "@/lib/pricing";
import { formatArs } from "@/lib/money";
import { createPublicOrder } from "@/server/actions/public-orders";

interface ProductOpt {
  id: string;
  name: string;
  priceCents: number;
  category: string;
}
interface SlotOpt {
  id: string;
  label: string;
  time: string;
  /** Bowls left within the soft capacity (0 = "completo, a confirmar"). */
  softRemaining: number;
  /** Bowls left within the hard ceiling, or null when there is no hard cap. */
  hardRemaining: number | null;
}
export interface DayOption {
  date: string;
  label: string;
  dailySoftRemaining: number;
  dailyHardRemaining: number | null;
  slots: SlotOpt[];
}

interface Props {
  products: ProductOpt[];
  paymentMethods: { id: string; name: string }[];
  discounts: PricingTier[];
  days: DayOption[];
}

export function PublicOrderForm({ products, paymentMethods, discounts, days }: Props) {
  const [pending, startTransition] = useTransition();

  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [date, setDate] = useState(days[0]?.date ?? "");
  const [slotId, setSlotId] = useState("");
  const [fulfillmentType, setFulfillmentType] = useState<"delivery" | "pickup">("delivery");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("+54 ");
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerNotes, setCustomerNotes] = useState("");
  const [paymentMethodId, setPaymentMethodId] = useState(paymentMethods[0]?.id ?? "");
  const [website, setWebsite] = useState(""); // honeypot
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const items = useMemo(
    () =>
      Object.entries(quantities)
        .filter(([, q]) => q > 0)
        .map(([productId, quantity]) => ({ productId, quantity })),
    [quantities],
  );
  const totalBowls = items.reduce((s, i) => s + i.quantity, 0);

  const pricing = useMemo(() => {
    const pricingItems: PricingItem[] = items
      .map((i) => {
        const p = productById.get(i.productId);
        return p
          ? { product: { priceCents: p.priceCents, category: p.category }, quantity: i.quantity }
          : null;
      })
      .filter((x): x is PricingItem => x !== null);
    return priceOrder(pricingItems, discounts);
  }, [items, productById, discounts]);

  const selectedDay = days.find((d) => d.date === date) ?? days[0];
  const selectedSlot = selectedDay?.slots.find((s) => s.id === slotId);
  const isPickup = fulfillmentType === "pickup";

  // Hard ceiling (null = no limit) blocks; soft over-capacity only flags for review.
  const slotHardRem = selectedSlot?.hardRemaining ?? null;
  const dayHardRem = selectedDay?.dailyHardRemaining ?? null;
  const exceedsHard =
    (slotHardRem !== null && totalBowls > slotHardRem) ||
    (dayHardRem !== null && totalBowls > dayHardRem);
  const softRem = selectedSlot
    ? Math.min(selectedSlot.softRemaining, selectedDay?.dailySoftRemaining ?? Infinity)
    : Infinity;
  const needsVerification = Boolean(selectedSlot) && totalBowls > softRem && !exceedsHard;

  function setQty(id: string, value: number) {
    setQuantities((prev) => {
      const next = { ...prev };
      const v = Math.max(0, value);
      if (v === 0) delete next[id];
      else next[id] = v;
      return next;
    });
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    if (items.length === 0) {
      toast.error("Elegí al menos un plato.");
      return;
    }
    if (!slotId) {
      toast.error("Elegí un horario.");
      return;
    }
    startTransition(async () => {
      const result = await createPublicOrder({
        customerName,
        customerPhone,
        customerAddress: isPickup ? "" : customerAddress,
        fulfillmentType,
        paymentMethodId,
        deliveryDate: date,
        deliverySlotId: slotId,
        items,
        customerNotes,
        website,
      });
      if (result.ok) {
        toast.success(
          result.data.needsVerification
            ? "¡Pedido recibido! Queda en verificación, te confirmamos por WhatsApp."
            : "¡Pedido enviado!",
        );
        window.location.href = `/p/${result.data.token}`;
        return;
      }
      if (result.fieldErrors) setFieldErrors(result.fieldErrors);
      toast.error(result.error);
    });
  }

  const err = (f: string) => fieldErrors[f]?.[0];

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {/* Products */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">¿Qué querés pedir?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {products.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between gap-3 rounded-lg border p-3"
            >
              <div className="min-w-0">
                <div className="truncate font-medium">{p.name}</div>
                <div className="text-sm text-muted-foreground tabular-nums">
                  {formatArs(p.priceCents)}
                </div>
              </div>
              <Stepper value={quantities[p.id] ?? 0} onChange={(v) => setQty(p.id, v)} />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* When */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">¿Cuándo?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Día de entrega</Label>
            <Select
              value={date}
              onValueChange={(v) => {
                setDate(v);
                setSlotId("");
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {days.map((d) => (
                  <SelectItem key={d.date} value={d.date} className="capitalize">
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Horario</Label>
            <div className="grid grid-cols-2 gap-2">
              {selectedDay?.slots.map((s) => {
                const hardFull = s.hardRemaining !== null && s.hardRemaining <= 0;
                const softFull = s.softRemaining <= 0;
                const active = s.id === slotId;
                return (
                  <button
                    key={s.id}
                    type="button"
                    disabled={hardFull}
                    onClick={() => setSlotId(s.id)}
                    className={cn(
                      "rounded-lg border p-2 text-left text-sm transition",
                      active && "border-primary ring-2 ring-primary/30",
                      hardFull ? "cursor-not-allowed opacity-50" : "hover:bg-accent",
                    )}
                  >
                    <div className="font-medium tabular-nums">{s.time}</div>
                    <div className="text-xs text-muted-foreground">
                      {hardFull
                        ? "No disponible"
                        : softFull
                          ? "Completo · a confirmar"
                          : `Quedan ${s.softRemaining}`}
                    </div>
                  </button>
                );
              })}
            </div>
            {exceedsHard && (
              <p className="flex items-center gap-1.5 text-sm text-destructive">
                <AlertTriangle className="h-4 w-4" />
                Ese horario no tiene lugar para {totalBowls} tazón/es. Reducí la
                cantidad o elegí otro horario.
              </p>
            )}
            {needsVerification && (
              <p className="flex items-start gap-1.5 rounded-md border border-warning/40 bg-warning/10 p-2 text-sm text-warning-foreground">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                Ese horario ya está completo. Podés pedir igual: tu pedido queda{" "}
                <strong>en verificación</strong> y te confirmamos por WhatsApp.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* How + who */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tus datos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={fulfillmentType === "delivery" ? "default" : "outline"}
              onClick={() => setFulfillmentType("delivery")}
            >
              Envío a domicilio
            </Button>
            <Button
              type="button"
              variant={fulfillmentType === "pickup" ? "default" : "outline"}
              onClick={() => setFulfillmentType("pickup")}
            >
              Retiro en el local
            </Button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="po-name">Nombre</Label>
            <Input
              id="po-name"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Tu nombre"
            />
            {err("customerName") && (
              <p className="text-sm font-medium text-destructive">{err("customerName")}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="po-phone">Teléfono</Label>
            <Input
              id="po-phone"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              inputMode="tel"
              placeholder="+54 9 381 ..."
            />
            {err("customerPhone") && (
              <p className="text-sm font-medium text-destructive">{err("customerPhone")}</p>
            )}
          </div>

          {!isPickup && (
            <div className="space-y-2">
              <Label htmlFor="po-address">Dirección de entrega</Label>
              <Input
                id="po-address"
                value={customerAddress}
                onChange={(e) => setCustomerAddress(e.target.value)}
                placeholder="Calle, número, barrio, referencias"
              />
              {err("customerAddress") && (
                <p className="text-sm font-medium text-destructive">
                  {err("customerAddress")}
                </p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label>Forma de pago</Label>
            <Select value={paymentMethodId} onValueChange={setPaymentMethodId}>
              <SelectTrigger>
                <SelectValue placeholder="Elegí cómo pagás" />
              </SelectTrigger>
              <SelectContent>
                {paymentMethods.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {err("paymentMethodId") && (
              <p className="text-sm font-medium text-destructive">{err("paymentMethodId")}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="po-notes">Aclaraciones (opcional)</Label>
            <Textarea
              id="po-notes"
              value={customerNotes}
              onChange={(e) => setCustomerNotes(e.target.value)}
              placeholder="Sin cebolla, extra picante, etc."
              rows={2}
            />
          </div>

          {/* Honeypot: hidden from users */}
          <input
            type="text"
            name="website"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            tabIndex={-1}
            autoComplete="off"
            aria-hidden
            className="hidden"
          />
        </CardContent>
      </Card>

      {/* Summary + submit */}
      <Card>
        <CardContent className="space-y-3 pt-6">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Subtotal ({totalBowls} tazón/es)</span>
            <span className="tabular-nums">{formatArs(pricing.subtotalCents)}</span>
          </div>
          {pricing.discountCents > 0 && (
            <div className="flex items-center justify-between text-sm text-success">
              <span>Descuento</span>
              <span className="tabular-nums">−{formatArs(pricing.discountCents)}</span>
            </div>
          )}
          <div className="flex items-baseline justify-between border-t pt-2">
            <span className="font-semibold">Total</span>
            <span className="text-2xl font-bold tabular-nums">
              {formatArs(pricing.totalCents)}
            </span>
          </div>
          <Button
            type="submit"
            className="w-full"
            disabled={pending || items.length === 0 || !slotId || exceedsHard}
          >
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {needsVerification ? "Enviar pedido (a confirmar)" : "Enviar pedido"}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Te confirmamos a la brevedad. Vas a poder ver el estado de tu pedido en
            un enlace.
          </p>
        </CardContent>
      </Card>
    </form>
  );
}

function Stepper({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-8 w-8"
        onClick={() => onChange(value - 1)}
        disabled={value <= 0}
        aria-label="Restar"
      >
        <Minus className="h-4 w-4" />
      </Button>
      <span className="w-6 text-center font-medium tabular-nums">{value}</span>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-8 w-8"
        onClick={() => onChange(value + 1)}
        aria-label="Sumar"
      >
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  );
}
