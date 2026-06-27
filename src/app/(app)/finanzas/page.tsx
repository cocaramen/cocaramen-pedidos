import { getProfit, getMarginByProduct, isGranularity, type Granularity } from "@/server/financial-queries";
import { formatArs } from "@/lib/money";
import { PageHeader } from "@/components/page-header";
import { FinanceControls } from "@/components/finanzas/finance-controls";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ from?: string; to?: string; g?: string }>;

const ISO = /^\d{4}-\d{2}-\d{2}$/;

function defaultRange(): { from: string; to: string } {
  const now = new Date();
  const from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const to = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()).padStart(2, "0")}`;
  return { from, to };
}

function Kpi({ label, value, accent }: { label: string; value: string; accent?: "good" | "bad" | "muted" }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div
          className={
            "text-xl font-bold tabular-nums " +
            (accent === "good" ? "text-success" : accent === "bad" ? "text-destructive" : "")
          }
        >
          {value}
        </div>
      </CardContent>
    </Card>
  );
}

export default async function FinanzasPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const def = defaultRange();
  const from = sp.from && ISO.test(sp.from) ? sp.from : def.from;
  const to = sp.to && ISO.test(sp.to) ? sp.to : def.to;
  const granularity: Granularity = sp.g && isGranularity(sp.g) ? sp.g : "week";

  const [report, byProduct] = await Promise.all([
    getProfit(from, to, granularity),
    getMarginByProduct(from, to),
  ]);
  const s = report.summary;
  const marginPct = s.revenueCents > 0 ? Math.round((s.netCents / s.revenueCents) * 100) : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Finanzas"
        description={`Ganancia (cobrado) · ${from} → ${to} · ${s.paidOrders} pedido(s) pagados`}
      />
      <FinanceControls from={from} to={to} granularity={granularity} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Kpi label="Ingreso (cobrado)" value={formatArs(s.revenueCents)} />
        <Kpi label="Costo de productos (COGS)" value={formatArs(s.cogsCents)} accent="muted" />
        <Kpi label="Margen bruto" value={formatArs(s.grossCents)} accent="good" />
        <Kpi label="Costo de envíos" value={formatArs(s.deliveryCostCents)} accent="muted" />
        <Kpi label="Gastos" value={formatArs(s.expensesCents)} accent="muted" />
        <Kpi
          label={`Margen neto (${marginPct}%)`}
          value={formatArs(s.netCents)}
          accent={s.netCents >= 0 ? "good" : "bad"}
        />
      </div>

      {s.unpaidRevenueCents > 0 && (
        <p className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm text-warning-foreground">
          Hay {formatArs(s.unpaidRevenueCents)} en ventas de este período aún sin marcar como
          pagadas — no se cuentan como ingreso hasta que las marques pagadas.
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Por período</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Período</TableHead>
                <TableHead className="text-right">Ingreso</TableHead>
                <TableHead className="text-right">COGS</TableHead>
                <TableHead className="text-right">Envíos</TableHead>
                <TableHead className="text-right">Gastos</TableHead>
                <TableHead className="text-right">Neto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.periods.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                    Sin datos en el período.
                  </TableCell>
                </TableRow>
              )}
              {report.periods.map((p) => (
                <TableRow key={p.bucket}>
                  <TableCell className="font-medium tabular-nums">{p.bucket}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatArs(p.revenueCents)}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {formatArs(p.cogsCents)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {formatArs(p.deliveryCostCents)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {formatArs(p.expensesCents)}
                  </TableCell>
                  <TableCell
                    className={
                      "text-right font-semibold tabular-nums " +
                      (p.netCents >= 0 ? "text-success" : "text-destructive")
                    }
                  >
                    {formatArs(p.netCents)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Rentabilidad por producto</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead className="text-center">Cant.</TableHead>
                <TableHead className="text-right">Ingreso</TableHead>
                <TableHead className="text-right">Costo</TableHead>
                <TableHead className="text-right">Margen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {byProduct.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                    Sin ventas pagadas en el período.
                  </TableCell>
                </TableRow>
              )}
              {byProduct.map((p) => (
                <TableRow key={p.productId}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell className="text-center tabular-nums">{p.qty}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatArs(p.revenue)}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {formatArs(p.cost)}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums text-success">
                    {formatArs(p.revenue - p.cost)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
