import Link from "next/link";
import {
  Soup,
  Plus,
  AlertTriangle,
  ClipboardList,
  ShieldCheck,
  MapPin,
  ChevronRight,
  PackageOpen,
} from "lucide-react";

import { getDashboardData } from "@/server/queries";
import { getSettings } from "@/server/settings";
import { nextDeliveryDate, formatLongDate } from "@/lib/dates";
import { STATUS_LABELS, ORDER_STATUSES } from "@/lib/order-status";
import type { OrderStatus } from "@/db/schema";

import { PageHeader } from "@/components/page-header";
import { CapacityMeter } from "@/components/capacity-meter";
import { StatusBadge } from "@/components/orders/status-badge";
import { DateSwitcher } from "@/components/dashboard/date-switcher";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;
type OrderItem = DashboardData["orders"][number];

const OTHER_SLOT = "__other__";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const [{ date: dateParam }, settings] = await Promise.all([
    searchParams,
    getSettings(),
  ]);

  const date = dateParam ?? nextDeliveryDate(settings.activeDeliveryDays);
  const data = await getDashboardData(date);

  const {
    dailyBowls,
    dailyCapacity,
    dailyRemaining,
    dailyExceeded,
    orderCount,
    overCapacityOrders,
    slots,
    orders,
    statusCounts,
  } = data;

  // Group orders by slot, preserving the slot ordering from `slots`.
  const ordersBySlot = new Map<string, OrderItem[]>();
  for (const slot of slots) ordersBySlot.set(slot.slotId, []);
  const knownSlotIds = new Set(slots.map((s) => s.slotId));
  for (const order of orders) {
    const key =
      order.deliverySlotId && knownSlotIds.has(order.deliverySlotId)
        ? order.deliverySlotId
        : OTHER_SLOT;
    const bucket = ordersBySlot.get(key);
    if (bucket) bucket.push(order);
    else ordersBySlot.set(key, [order]);
  }
  const otherOrders = ordersBySlot.get(OTHER_SLOT) ?? [];

  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-8">
        <PageHeader title="Panel" description={capitalize(formatLongDate(date))}>
          <DateSwitcher date={date} />
          <Button asChild>
            <Link href="/orders/new">
              <Plus />
              Nuevo Pedido
            </Link>
          </Button>
        </PageHeader>

        {/* Summary cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard
            label="Total de tazones del día"
            value={dailyBowls}
            icon={<Soup className="size-4" />}
          />
          <SummaryCard
            label="Capacidad diaria"
            value={dailyCapacity}
            icon={<ShieldCheck className="size-4" />}
          />
          <SummaryCard
            label="Capacidad restante"
            value={dailyRemaining}
            valueClassName={dailyRemaining < 0 ? "text-destructive" : undefined}
            icon={<PackageOpen className="size-4" />}
          />
          <SummaryCard
            label="Pedidos"
            value={orderCount}
            icon={<ClipboardList className="size-4" />}
            footer={
              overCapacityOrders > 0 ? (
                <Badge variant="warning" className="mt-1 gap-1">
                  <AlertTriangle className="size-3" />
                  {overCapacityOrders}{" "}
                  {overCapacityOrders === 1
                    ? "pedido con sobrecapacidad"
                    : "pedidos con sobrecapacidad"}
                </Badge>
              ) : null
            }
          />
        </div>

        {/* Daily capacity meter */}
        <Card>
          <CardContent className="space-y-4 pt-6">
            <CapacityMeter
              label="Capacidad diaria"
              used={dailyBowls}
              capacity={dailyCapacity}
              exceeded={dailyExceeded}
            />
            {dailyExceeded && (
              <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm text-warning-foreground">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
                <p>
                  La capacidad diaria se ha superado en{" "}
                  <span className="font-semibold tabular-nums">
                    {dailyBowls - dailyCapacity}
                  </span>{" "}
                  tazones. Revisa los pedidos antes de confirmarlos.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {orderCount === 0 ? (
          <EmptyState />
        ) : (
          <>
            {/* Status summary */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">
                Estado:
              </span>
              {ORDER_STATUSES.map((status) => {
                const count = statusCounts[status] ?? 0;
                if (count === 0) return null;
                return (
                  <Badge key={status} variant="secondary" className="gap-1.5">
                    <StatusDot status={status} />
                    {STATUS_LABELS[status]}
                    <span className="tabular-nums font-semibold">{count}</span>
                  </Badge>
                );
              })}
            </div>

            {/* Slot utilization */}
            {slots.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-lg font-semibold tracking-tight">
                  Utilización por franja
                </h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {slots.map((slot) => (
                    <Card key={slot.slotId}>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between gap-2">
                          <CardTitle className="text-base">
                            {slot.label}
                          </CardTitle>
                          {slot.exceeded && (
                            <Badge variant="warning" className="gap-1">
                              <AlertTriangle className="size-3" />
                              Superada
                            </Badge>
                          )}
                        </div>
                        <CardDescription>
                          {slot.orderCount}{" "}
                          {slot.orderCount === 1 ? "pedido" : "pedidos"}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <CapacityMeter
                          label="Tazones"
                          used={slot.bowls}
                          capacity={slot.capacity}
                          exceeded={slot.exceeded}
                        />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            )}

            {/* Orders by slot */}
            <section className="space-y-4">
              <h2 className="text-lg font-semibold tracking-tight">
                Pedidos por franja
              </h2>
              <div className="space-y-6">
                {slots.map((slot) => {
                  const slotOrders = ordersBySlot.get(slot.slotId) ?? [];
                  if (slotOrders.length === 0) return null;
                  return (
                    <SlotGroup
                      key={slot.slotId}
                      title={slot.label}
                      count={slotOrders.length}
                      orders={slotOrders}
                    />
                  );
                })}
                {otherOrders.length > 0 && (
                  <SlotGroup
                    title="Otras franjas"
                    count={otherOrders.length}
                    orders={otherOrders}
                  />
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </TooltipProvider>
  );
}

function SummaryCard({
  label,
  value,
  icon,
  valueClassName,
  footer,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  valueClassName?: string;
  footer?: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
        <span className="text-muted-foreground">{icon}</span>
      </CardHeader>
      <CardContent>
        <div
          className={cn(
            "text-3xl font-bold tabular-nums tracking-tight",
            valueClassName,
          )}
        >
          {value}
        </div>
        {footer}
      </CardContent>
    </Card>
  );
}

function SlotGroup({
  title,
  count,
  orders,
}: {
  title: string;
  count: number;
  orders: OrderItem[];
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">{title}</CardTitle>
          <Badge variant="outline" className="tabular-nums">
            {count} {count === 1 ? "pedido" : "pedidos"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="px-2 pb-2">
        <ul className="divide-y">
          {orders.map((order) => (
            <OrderRow key={order.id} order={order} />
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function OrderRow({ order }: { order: OrderItem }) {
  return (
    <li>
      <Link
        href={`/orders/${order.id}/edit`}
        className="group flex items-center gap-3 rounded-md px-2 py-2.5 transition-colors hover:bg-accent"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium">{order.customerName}</span>
            {order.overCapacityApproved && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-warning">
                    <AlertTriangle className="size-4" />
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  Capacidad superada, aprobado manualmente
                </TooltipContent>
              </Tooltip>
            )}
          </div>
          <div className="flex items-center gap-1 truncate text-xs text-muted-foreground">
            <MapPin className="size-3 shrink-0" />
            <span className="truncate">
              {order.customerAddress || "Sin dirección"}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1 text-sm tabular-nums">
          <Soup className="size-4 text-muted-foreground" />
          <span className="font-semibold">{order.totalBowls}</span>
        </div>

        <StatusBadge status={order.status} />

        <ChevronRight className="size-4 shrink-0 text-muted-foreground/50 transition-colors group-hover:text-muted-foreground" />
      </Link>
    </li>
  );
}

function EmptyState() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center gap-4 py-16 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <PackageOpen className="size-6" />
        </div>
        <div className="space-y-1">
          <p className="text-lg font-semibold">No hay pedidos para esta fecha</p>
          <p className="text-sm text-muted-foreground">
            Crea un nuevo pedido para empezar a llenar la jornada.
          </p>
        </div>
        <Button asChild>
          <Link href="/orders/new">
            <Plus />
            Nuevo Pedido
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function StatusDot({ status }: { status: OrderStatus }) {
  const colors: Record<OrderStatus, string> = {
    pending: "bg-slate-400",
    confirmed: "bg-blue-500",
    preparing: "bg-amber-500",
    out_for_delivery: "bg-violet-500",
    delivered: "bg-emerald-500",
    cancelled: "bg-rose-500",
  };
  return <span className={cn("size-2 rounded-full", colors[status])} />;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
