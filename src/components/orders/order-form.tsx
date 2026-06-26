"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Minus, Plus, Loader2, AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CapacityMeter } from "@/components/capacity-meter";
import { AddressPicker, type SearchArea } from "@/components/orders/address-picker";
import { cn } from "@/lib/utils";
import type {
  Product,
  DeliverySlot,
  OrderStatus,
  VolumeDiscount,
  PaymentMethod,
  ShippingMethod,
  FulfillmentType,
} from "@/db/schema";
import type { CapacityEvaluation } from "@/lib/capacity";
import { priceOrder, type PricingItem } from "@/lib/pricing";
import { formatArs } from "@/lib/money";
import { STATUS_LABELS, ORDER_STATUSES } from "@/lib/order-status";
import { trimTime } from "@/lib/dates";
import { previewCapacity } from "@/server/actions/capacity";
import { createOrder, updateOrder } from "@/server/actions/orders";

export interface OrderFormInitial {
  id: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  latitude: number | null;
  longitude: number | null;
  customerNotes: string | null;
  internalNotes: string | null;
  trackingUrl: string | null;
  fulfillmentType: FulfillmentType;
  paymentMethodId: string | null;
  shippingMethodId: string | null;
  deliveryDate: string;
  deliverySlotId: string;
  status: OrderStatus;
  items: { productId: string; quantity: number }[];
}

interface Props {
  products: Product[];
  volumeDiscounts: VolumeDiscount[];
  slots: DeliverySlot[];
  paymentMethods: PaymentMethod[];
  shippingMethods: ShippingMethod[];
  defaultDate: string;
  initial?: OrderFormInitial;
  searchArea?: SearchArea | null;
}

export function OrderForm({
  products,
  volumeDiscounts,
  slots,
  paymentMethods,
  shippingMethods,
  defaultDate,
  initial,
  searchArea,
}: Props) {
  const router = useRouter();
  const isEdit = Boolean(initial);
  const [pending, startTransition] = useTransition();

  const [customerName, setCustomerName] = useState(initial?.customerName ?? "");
  // New orders default to the Argentina country code (+54); edited orders keep theirs.
  const [customerPhone, setCustomerPhone] = useState(initial?.customerPhone ?? "+54 ");
  const [customerAddress, setCustomerAddress] = useState(initial?.customerAddress ?? "");
  const [latitude, setLatitude] = useState<number | null>(initial?.latitude ?? null);
  const [longitude, setLongitude] = useState<number | null>(initial?.longitude ?? null);
  const [customerNotes, setCustomerNotes] = useState(initial?.customerNotes ?? "");
  const [internalNotes, setInternalNotes] = useState(initial?.internalNotes ?? "");
  const [trackingUrl, setTrackingUrl] = useState(initial?.trackingUrl ?? "");
  const [fulfillmentType, setFulfillmentType] = useState<FulfillmentType>(
    initial?.fulfillmentType ?? "delivery",
  );
  const [paymentMethodId, setPaymentMethodId] = useState(
    initial?.paymentMethodId ?? paymentMethods[0]?.id ?? "",
  );
  const [shippingMethodId, setShippingMethodId] = useState(
    initial?.shippingMethodId ?? "",
  );
  const [deliveryDate, setDeliveryDate] = useState(initial?.deliveryDate ?? defaultDate);
  const isPickup = fulfillmentType === "pickup";
  const [deliverySlotId, setDeliverySlotId] = useState(
    initial?.deliverySlotId ?? slots[0]?.id ?? "",
  );
  const [status, setStatus] = useState<OrderStatus>(initial?.status ?? "pending");

  const [quantities, setQuantities] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    initial?.items.forEach((i) => (map[i.productId] = i.quantity));
    return map;
  });

  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [preview, setPreview] = useState<CapacityEvaluation | null>(null);
  const [confirmEval, setConfirmEval] = useState<CapacityEvaluation | null>(null);

  const items = useMemo(
    () =>
      Object.entries(quantities)
        .filter(([, q]) => q > 0)
        .map(([productId, quantity]) => ({ productId, quantity })),
    [quantities],
  );
  const totalBowls = items.reduce((s, i) => s + i.quantity, 0);

  // ── Live price summary (subtotal, volume discount, total) ──
  const productById = useMemo(
    () => new Map(products.map((p) => [p.id, p])),
    [products],
  );
  const pricing = useMemo(() => {
    const pricingItems: PricingItem[] = items
      .map((i) => {
        const p = productById.get(i.productId);
        return p
          ? { product: { priceCents: p.priceCents, category: p.category }, quantity: i.quantity }
          : null;
      })
      .filter((x): x is PricingItem => x !== null);
    return priceOrder(pricingItems, volumeDiscounts);
  }, [items, productById, volumeDiscounts]);

  // ── Live capacity preview (debounced, server-authoritative) ──
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    if (!deliveryDate || !deliverySlotId) {
      setPreview(null);
      return;
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      previewCapacity({
        date: deliveryDate,
        slotId: deliverySlotId,
        bowls: totalBowls,
        excludeOrderId: initial?.id,
      })
        .then(setPreview)
        .catch(() => setPreview(null));
    }, 250);
    return () => clearTimeout(debounceRef.current);
  }, [deliveryDate, deliverySlotId, totalBowls, initial?.id]);

  function setQty(id: string, value: number) {
    setQuantities((prev) => {
      const next = { ...prev };
      const v = Math.max(0, value);
      if (v === 0) delete next[id];
      else next[id] = v;
      return next;
    });
  }

  function buildPayload(approved: boolean) {
    return {
      customerName,
      customerPhone,
      customerAddress,
      latitude,
      longitude,
      customerNotes,
      internalNotes,
      trackingUrl: isPickup ? "" : trackingUrl,
      fulfillmentType,
      paymentMethodId: paymentMethodId || null,
      shippingMethodId: isPickup ? null : shippingMethodId || null,
      deliveryDate,
      deliverySlotId,
      status,
      items,
      overCapacityApproved: approved,
    };
  }

  function submit(approved: boolean) {
    setFieldErrors({});
    startTransition(async () => {
      const payload = buildPayload(approved);
      const result = isEdit
        ? await updateOrder(initial!.id, payload)
        : await createOrder(payload);

      if (result.ok) {
        toast.success(isEdit ? "Pedido actualizado" : "Pedido creado");
        setConfirmEval(null);
        router.push("/orders");
        router.refresh();
        return;
      }

      if (result.needsApproval && result.capacity) {
        setConfirmEval(result.capacity);
        return;
      }
      if (result.fieldErrors) {
        setFieldErrors(result.fieldErrors);
      }
      toast.error(result.error);
    });
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    submit(false);
  }

  const err = (field: string) => fieldErrors[field]?.[0];

  return (
    <form onSubmit={onSubmit} className="grid gap-6 lg:grid-cols-[1fr_360px]">
      {/* Main column */}
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Datos del cliente</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre del cliente" error={err("customerName")} required>
              <Input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Juan Pérez"
              />
            </Field>
            <Field label="Teléfono" error={err("customerPhone")} required>
              <Input
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="+54 9 11 1234 5678"
                inputMode="tel"
              />
            </Field>
            {!isPickup ? (
              <Field label="Dirección de entrega" required className="sm:col-span-2">
                <AddressPicker
                  address={customerAddress}
                  onAddressChange={setCustomerAddress}
                  lat={latitude}
                  lng={longitude}
                  onCoordsChange={(la, lo) => {
                    setLatitude(la);
                    setLongitude(lo);
                  }}
                  error={err("customerAddress")}
                  searchArea={searchArea}
                />
              </Field>
            ) : (
              <div className="sm:col-span-2 rounded-md border border-dashed bg-muted/30 p-3 text-sm text-muted-foreground">
                Retiro en el local — no se requiere dirección de entrega.
              </div>
            )}
            <Field label="Observaciones del cliente" className="sm:col-span-2">
              <Textarea
                value={customerNotes}
                onChange={(e) => setCustomerNotes(e.target.value)}
                placeholder="Sin cebolla, extra picante, etc."
                rows={2}
              />
            </Field>
            <Field label="Notas internas" className="sm:col-span-2">
              <Textarea
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
                placeholder="Notas visibles solo para el equipo"
                rows={2}
              />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Entrega</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Tipo de entrega" required>
              <Select
                value={fulfillmentType}
                onValueChange={(v) => setFulfillmentType(v as FulfillmentType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="delivery">Envío a domicilio</SelectItem>
                  <SelectItem value="pickup">Retiro en el local</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Forma de pago" error={err("paymentMethodId")} required>
              <Select value={paymentMethodId} onValueChange={setPaymentMethodId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccione forma de pago" />
                </SelectTrigger>
                <SelectContent>
                  {paymentMethods.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Fecha de entrega" error={err("deliveryDate")} required>
              <Input
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
              />
            </Field>
            <Field label="Franja horaria" error={err("deliverySlotId")} required>
              <Select value={deliverySlotId} onValueChange={setDeliverySlotId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccione franja" />
                </SelectTrigger>
                <SelectContent>
                  {slots.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.label} · cap. {s.capacityLimit}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            {!isPickup && (
              <Field label="Forma de envío" error={err("shippingMethodId")} className="sm:col-span-2">
                <Select value={shippingMethodId} onValueChange={setShippingMethodId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccione cómo se envía" />
                  </SelectTrigger>
                  <SelectContent>
                    {shippingMethods.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
            {isEdit && (
              <Field label="Estado" className="sm:col-span-2">
                <Select value={status} onValueChange={(v) => setStatus(v as OrderStatus)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ORDER_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {STATUS_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
            {!isPickup && (
              <Field
                label="Link de seguimiento"
                error={err("trackingUrl")}
                className="sm:col-span-2"
              >
                <Input
                  value={trackingUrl}
                  onChange={(e) => setTrackingUrl(e.target.value)}
                  placeholder="https://maps.app.goo.gl/…  (opcional, para el mensaje «En reparto»)"
                  inputMode="url"
                />
              </Field>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tazones</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {products.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No hay productos activos. Configúrelos en Configuración.
              </p>
            )}
            {products.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div>
                  <span className="font-medium">{p.name}</span>
                  <span className="ml-2 text-sm text-muted-foreground tabular-nums">
                    {formatArs(p.priceCents)}
                  </span>
                </div>
                <Stepper
                  value={quantities[p.id] ?? 0}
                  onChange={(v) => setQty(p.id, v)}
                />
              </div>
            ))}
            {err("items") && (
              <p className="text-sm font-medium text-destructive">{err("items")}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Sidebar: live capacity + summary */}
      <div className="space-y-6 lg:sticky lg:top-20 lg:self-start">
        <Card>
          <CardHeader>
            <CardTitle>Capacidad en vivo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-muted-foreground">Tazones</span>
              <span className="text-2xl font-bold tabular-nums">{totalBowls}</span>
            </div>

            <div className="space-y-1.5 border-y py-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="tabular-nums">{formatArs(pricing.subtotalCents)}</span>
              </div>
              {pricing.discountCents > 0 && (
                <div className="flex items-center justify-between text-success">
                  <span>Descuento por cantidad</span>
                  <span className="tabular-nums">
                    −{formatArs(pricing.discountCents)}
                  </span>
                </div>
              )}
              <div className="flex items-baseline justify-between pt-1">
                <span className="font-medium">Total</span>
                <span className="text-xl font-bold tabular-nums">
                  {formatArs(pricing.totalCents)}
                </span>
              </div>
            </div>
            {preview ? (
              <>
                <CapacityMeter
                  label="Franja horaria"
                  used={preview.newSlotTotal}
                  capacity={preview.slotCapacity}
                  exceeded={preview.exceededSlotCapacity}
                />
                <CapacityMeter
                  label="Día"
                  used={preview.newDailyTotal}
                  capacity={preview.dailyCapacity}
                  exceeded={preview.exceededDailyCapacity}
                />
                {preview.requiresApproval && (
                  <div className="flex gap-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm text-warning-foreground">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                    <div className="space-y-1">
                      {preview.slotWarning && <p>{preview.slotWarning}</p>}
                      {preview.dailyWarning && <p>{preview.dailyWarning}</p>}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Seleccione fecha y franja para ver la capacidad.
              </p>
            )}

            <Button type="submit" className="w-full" disabled={pending}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? "Guardar cambios" : "Crear pedido"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => router.back()}
              disabled={pending}
            >
              Cancelar
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Over-capacity confirmation */}
      <AlertDialog open={Boolean(confirmEval)} onOpenChange={(o) => !o && setConfirmEval(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Capacidad superada
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-left">
                {confirmEval?.slotWarning && <p>{confirmEval.slotWarning}</p>}
                {confirmEval?.dailyWarning && <p>{confirmEval.dailyWarning}</p>}
                <p className="font-medium text-foreground">
                  ¿Desea guardar de todos modos?
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Revisar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                submit(true);
              }}
              disabled={pending}
              className={cn("bg-warning text-warning-foreground hover:bg-warning/90")}
            >
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar de todos modos
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  );
}

function Field({
  label,
  error,
  required,
  className,
  children,
}: {
  label: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <Label>
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </Label>
      {children}
      {error && <p className="text-sm font-medium text-destructive">{error}</p>}
    </div>
  );
}

function Stepper({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
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
      <Input
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-8 w-16 text-center tabular-nums"
      />
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
