import Link from "next/link";
import { MapPin, Navigation, ExternalLink, Soup, AlertTriangle, Settings } from "lucide-react";
import {
  getActiveSlots,
  getOrdersForRouting,
  getActiveShippingMethods,
  getDeliveryRuns,
} from "@/server/queries";
import { getSettings } from "@/server/settings";
import { optimizeRoute, type RouteStop } from "@/server/route-service";
import { googleMapsDirUrl, formatDistance, formatDuration } from "@/lib/route";
import { nextDeliveryDate, formatLongDate } from "@/lib/dates";
import { PageHeader } from "@/components/page-header";
import { RouteControls } from "@/components/routes/route-controls";
import { RouteMap } from "@/components/routes/route-map";
import { RunCostsEditor, type RunRow } from "@/components/routes/run-costs-editor";
import { StatusBadge } from "@/components/orders/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ date?: string; slots?: string }>;

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-2xl font-bold tabular-nums">{value}</div>
      </CardContent>
    </Card>
  );
}

export default async function RoutesPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const [settings, activeSlots] = await Promise.all([getSettings(), getActiveSlots()]);

  const date = sp.date || nextDeliveryDate(settings.activeDeliveryDays);
  const allSlotIds = activeSlots.map((s) => s.id);
  // No `slots` param => default to all active slots; empty string => none selected.
  const selected =
    sp.slots === undefined ? allSlotIds : sp.slots.split(",").filter(Boolean);

  const originConfigured = settings.originLat != null && settings.originLng != null;
  const origin = {
    lat: settings.originLat ?? 0,
    lng: settings.originLng ?? 0,
    address: settings.originAddress ?? "Origen sin configurar",
  };

  const header = (
    <PageHeader
      title="Ruta de reparto"
      description={`Ruta combinada óptima · ${formatLongDate(date)}`}
    />
  );

  if (!originConfigured) {
    return (
      <div className="space-y-6">
        {header}
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Settings className="h-6 w-6 text-muted-foreground" />
            </span>
            <p className="font-medium">Configurá el origen de reparto</p>
            <p className="max-w-md text-sm text-muted-foreground">
              Para calcular la ruta necesito saber desde dónde sale el repartidor
              (la cocina). Definilo en Configuración.
            </p>
            <Button asChild>
              <Link href="/settings">Ir a Configuración</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const [orders, shippingMethods, runs] = await Promise.all([
    selected.length ? getOrdersForRouting(date, selected) : Promise.resolve([]),
    getActiveShippingMethods(),
    getDeliveryRuns(date, selected),
  ]);
  const runBySlot = new Map(runs.map((r) => [r.slotId, r]));
  const runRows: RunRow[] = activeSlots
    .filter((s) => selected.includes(s.id))
    .map((s) => {
      const run = runBySlot.get(s.id);
      return {
        slotId: s.id,
        label: s.label,
        defaultCostCents: s.shippingCostCents,
        shippingMethodId: run?.shippingMethodId ?? null,
        actualCostCents: run?.actualCostCents ?? 0,
        hasRun: Boolean(run),
      };
    });
  const withCoords = orders.filter((o) => o.latitude != null && o.longitude != null);
  const withoutCoords = orders.filter((o) => o.latitude == null || o.longitude == null);

  const stops: RouteStop[] = withCoords.map((o) => ({
    id: o.id,
    lat: o.latitude as number,
    lng: o.longitude as number,
    customerName: o.customerName,
    customerAddress: o.customerAddress,
    customerPhone: o.customerPhone,
    totalBowls: o.totalBowls,
    slotLabel: o.slot?.label ?? "—",
    status: o.status,
  }));

  const route = await optimizeRoute(origin, stops);
  const totalBowls = route.ordered.reduce((s, o) => s + o.totalBowls, 0);
  // Navigate by COORDINATES (the verified pin), not text — Google's own
  // geocoder can misplace typed addresses (e.g. to Tafí Viejo). The pin is the
  // source of truth and matches what the operator sees on the map.
  const gmaps = googleMapsDirUrl(
    origin,
    route.ordered.map((s) => ({ lat: s.lat, lng: s.lng })),
  );
  const mapStops = route.ordered.map((s, i) => ({
    lat: s.lat,
    lng: s.lng,
    label: `<b>${i + 1}. ${s.customerName}</b><br/>${s.customerAddress}<br/>${s.totalBowls} tazón(es)`,
  }));

  return (
    <div className="space-y-6">
      {header}

      <Card>
        <CardContent className="pt-6">
          <RouteControls
            date={date}
            slots={activeSlots.map((s) => ({ id: s.id, label: s.label }))}
            selected={selected}
          />
        </CardContent>
      </Card>

      {runRows.length > 0 && (
        <RunCostsEditor date={date} rows={runRows} shippingMethods={shippingMethods} />
      )}

      {selected.length === 0 ? (
        <Card>
          <CardContent className="py-14 text-center text-sm text-muted-foreground">
            Elegí al menos una franja horaria para calcular la ruta.
          </CardContent>
        </Card>
      ) : stops.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-14 text-center">
            <MapPin className="h-6 w-6 text-muted-foreground" />
            <p className="font-medium">No hay pedidos con ubicación para rutear</p>
            <p className="text-sm text-muted-foreground">
              No hay pedidos pendientes con pin en las franjas elegidas.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Paradas" value={stops.length} />
            <Stat label="Tazones" value={totalBowls} />
            <Stat label="Distancia" value={formatDistance(route.distanceMeters)} />
            <Stat label="Tiempo estimado" value={formatDuration(route.durationSeconds)} />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground">
              {route.engine === "geoapify"
                ? "Ruta calculada por calles (Geoapify)."
                : "Orden optimizado por distancia directa (líneas rectas y tiempo estimado). Configurá GEOAPIFY_API_KEY para rutas por calles."}
            </span>
            <Button asChild>
              <a href={gmaps} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />
                Abrir en Google Maps
              </a>
            </Button>
          </div>

          <RouteMap origin={origin} stops={mapStops} geometry={route.geometry} />

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Navigation className="h-4 w-4" />
                Orden de entrega
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-3 rounded-md bg-muted/60 px-3 py-2 text-sm">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-foreground text-xs text-background">
                  🍜
                </span>
                <span className="font-medium">Salida · {origin.address}</span>
              </div>
              {route.ordered.map((s, i) => (
                <Link
                  key={s.id}
                  href={`/orders/${s.id}/edit`}
                  className="flex items-center gap-3 rounded-md border px-3 py-2 text-sm hover:bg-accent"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="font-medium">{s.customerName}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {s.customerAddress}
                    </span>
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    {s.slotLabel}
                  </span>
                  <span className="inline-flex items-center gap-1 font-semibold tabular-nums">
                    <Soup className="h-4 w-4 text-muted-foreground" />
                    {s.totalBowls}
                  </span>
                  <StatusBadge status={s.status as never} />
                </Link>
              ))}
            </CardContent>
          </Card>
        </>
      )}

      {withoutCoords.length > 0 && selected.length > 0 && (
        <Card className="border-warning/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-warning-foreground">
              <AlertTriangle className="h-4 w-4 text-warning" />
              {withoutCoords.length} pedido(s) sin ubicación (excluidos de la ruta)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Estos pedidos no tienen pin en el mapa. Editalos y colocá la ubicación
              para incluirlos en la ruta.
            </p>
            {withoutCoords.map((o) => (
              <Link
                key={o.id}
                href={`/orders/${o.id}/edit`}
                className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm hover:bg-accent"
              >
                <span className="min-w-0">
                  <span className="font-medium">{o.customerName}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {o.customerAddress}
                  </span>
                </span>
                <span className="text-xs text-primary">Agregar ubicación →</span>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
