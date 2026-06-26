"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Check } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatArs, pesosToCents, centsToPesosInput } from "@/lib/money";
import { upsertDeliveryRun } from "@/server/actions/routes";

const NONE = "__none__";

export interface RunRow {
  slotId: string;
  label: string;
  defaultCostCents: number;
  shippingMethodId: string | null;
  actualCostCents: number;
  hasRun: boolean;
}

interface Props {
  date: string;
  rows: RunRow[];
  shippingMethods: { id: string; name: string }[];
}

export function RunCostsEditor({ date, rows, shippingMethods }: Props) {
  // Live total reflects the saved costs (rows come from the server).
  const total = useMemo(
    () => rows.reduce((s, r) => s + (r.hasRun ? r.actualCostCents : 0), 0),
    [rows],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Costos de envío</CardTitle>
        <CardDescription>
          Registrá cuánto costó realmente el envío de cada franja en esta fecha.
          Arranca con el costo estándar de la franja; ajustalo y guardá.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Elegí al menos una franja para registrar costos.
          </p>
        ) : (
          rows.map((row) => (
            <RunRowEditor
              key={row.slotId}
              date={date}
              row={row}
              shippingMethods={shippingMethods}
            />
          ))
        )}
        {rows.length > 0 && (
          <div className="flex items-center justify-between border-t pt-3 text-sm">
            <span className="font-medium">Total costo de envío (registrado)</span>
            <span className="text-lg font-bold tabular-nums">{formatArs(total)}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RunRowEditor({
  date,
  row,
  shippingMethods,
}: {
  date: string;
  row: RunRow;
  shippingMethods: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  const [methodId, setMethodId] = useState(row.shippingMethodId ?? NONE);
  const [cost, setCost] = useState(
    centsToPesosInput(row.hasRun ? row.actualCostCents : row.defaultCostCents),
  );

  function onSave() {
    const actualCostCents = pesosToCents(cost);
    if (actualCostCents === null) {
      toast.error("Ingrese un costo válido.");
      return;
    }
    startTransition(async () => {
      const result = await upsertDeliveryRun({
        deliveryDate: date,
        slotId: row.slotId,
        shippingMethodId: methodId === NONE ? null : methodId,
        actualCostCents,
      });
      if (result.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
        toast.success(`Costo de ${row.label} guardado`);
        router.refresh();
        return;
      }
      toast.error(result.error);
    });
  }

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-md border p-3">
      <div className="min-w-[6rem] flex-1">
        <div className="text-sm font-medium tabular-nums">{row.label}</div>
        {!row.hasRun && (
          <div className="text-xs text-muted-foreground">
            Estándar: {formatArs(row.defaultCostCents)}
          </div>
        )}
      </div>
      <div className="w-44">
        <Select value={methodId} onValueChange={setMethodId}>
          <SelectTrigger>
            <SelectValue placeholder="Forma de envío" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>Sin especificar</SelectItem>
            {shippingMethods.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="relative w-32">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
          $
        </span>
        <Input
          inputMode="decimal"
          className="pl-7 tabular-nums"
          value={cost}
          onChange={(e) => setCost(e.target.value)}
        />
      </div>
      <Button type="button" onClick={onSave} disabled={pending}>
        {pending ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : saved ? (
          <Check className="mr-2 h-4 w-4 text-success" />
        ) : null}
        Guardar
      </Button>
    </div>
  );
}
