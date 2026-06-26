import Link from "next/link";
import { headers } from "next/headers";
import { AlertTriangle, PlusCircle, Soup, ClipboardList } from "lucide-react";
import { listOrders, getActiveSlots, type OrderListFilters } from "@/server/queries";
import { isValidStatus } from "@/lib/order-status";
import { PageHeader } from "@/components/page-header";
import { OrdersFilters } from "@/components/orders/orders-filters";
import { OrderRowActions } from "@/components/orders/order-row-actions";
import { StatusSelect } from "@/components/orders/status-select";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatShortDate, trimTime } from "@/lib/dates";
import type { OrderStatus } from "@/db/schema";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  search?: string;
  date?: string;
  slotId?: string;
  status?: string;
  sort?: string;
}>;

function itemsSummary(items: { quantity: number; product: { name: string } }[]): string {
  return items.map((i) => `${i.quantity}× ${i.product.name}`).join(", ");
}

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;

  const filters: OrderListFilters = {
    search: sp.search?.trim() || undefined,
    date: sp.date || undefined,
    slotId: sp.slotId || undefined,
    status:
      sp.status && isValidStatus(sp.status) ? (sp.status as OrderStatus) : undefined,
    sort: (sp.sort as OrderListFilters["sort"]) || "date_desc",
  };

  const [orders, slots] = await Promise.all([listOrders(filters), getActiveSlots()]);

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  const publicUrlFor = (token: string) => `${proto}://${host}/p/${token}`;

  return (
    <div className="space-y-6">
      <PageHeader title="Pedidos" description={`${orders.length} pedido(s) encontrados.`}>
        <Button asChild>
          <Link href="/orders/new">
            <PlusCircle className="mr-2 h-4 w-4" />
            Nuevo Pedido
          </Link>
        </Button>
      </PageHeader>

      <Card>
        <CardContent className="pt-6">
          <OrdersFilters slots={slots} />
        </CardContent>
      </Card>

      {orders.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <ClipboardList className="h-6 w-6 text-muted-foreground" />
            </span>
            <div>
              <p className="font-medium">No se encontraron pedidos</p>
              <p className="text-sm text-muted-foreground">
                Ajuste los filtros o cree un nuevo pedido.
              </p>
            </div>
            <Button asChild variant="outline">
              <Link href="/orders/new">
                <PlusCircle className="mr-2 h-4 w-4" />
                Nuevo Pedido
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <TooltipProvider>
          {/* Desktop table */}
          <Card className="hidden overflow-hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Dirección</TableHead>
                  <TableHead>Entrega</TableHead>
                  <TableHead className="text-center">Tazones</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((o) => (
                  <TableRow key={o.id} className="align-top">
                    <TableCell>
                      <Link
                        href={`/orders/${o.id}/edit`}
                        className="font-medium hover:underline"
                      >
                        {o.customerName}
                      </Link>
                      <div className="text-xs text-muted-foreground">{o.customerPhone}</div>
                    </TableCell>
                    <TableCell className="max-w-[260px]">
                      <span className="line-clamp-2 text-sm text-muted-foreground">
                        {o.customerAddress}
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      <div className="font-medium">{formatShortDate(o.deliveryDate)}</div>
                      <div className="text-xs text-muted-foreground">
                        {o.slot ? `${trimTime(o.slot.startTime)}–${trimTime(o.slot.endTime)}` : "—"}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex items-center gap-1 font-semibold tabular-nums">
                            <Soup className="h-4 w-4 text-muted-foreground" />
                            {o.totalBowls}
                            {o.overCapacityApproved && (
                              <AlertTriangle className="h-4 w-4 text-warning" />
                            )}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-[220px]">{itemsSummary(o.items) || "Sin tazones"}</p>
                          {o.overCapacityApproved && (
                            <p className="mt-1 text-warning">
                              Capacidad superada · aprobado manualmente
                            </p>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      <StatusSelect orderId={o.id} status={o.status} />
                    </TableCell>
                    <TableCell>
                      <OrderRowActions orderId={o.id} publicUrl={publicUrlFor(o.publicToken)} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {orders.map((o) => (
              <Card key={o.id}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <Link
                        href={`/orders/${o.id}/edit`}
                        className="font-semibold hover:underline"
                      >
                        {o.customerName}
                      </Link>
                      <div className="text-xs text-muted-foreground">{o.customerPhone}</div>
                    </div>
                    <OrderRowActions orderId={o.id} publicUrl={publicUrlFor(o.publicToken)} />
                  </div>
                  <p className="text-sm text-muted-foreground">{o.customerAddress}</p>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span>
                      {formatShortDate(o.deliveryDate)} · {o.slot?.label ?? "—"}
                    </span>
                    <span className="inline-flex items-center gap-1 font-semibold">
                      <Soup className="h-4 w-4" /> {o.totalBowls}
                      {o.overCapacityApproved && (
                        <AlertTriangle className="h-4 w-4 text-warning" />
                      )}
                    </span>
                  </div>
                  <StatusSelect orderId={o.id} status={o.status} />
                </CardContent>
              </Card>
            ))}
          </div>
        </TooltipProvider>
      )}
    </div>
  );
}
