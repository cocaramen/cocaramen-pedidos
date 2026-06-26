"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus, Pencil } from "lucide-react";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";

import { cn } from "@/lib/utils";
import { trimTime } from "@/lib/dates";
import { formatArs, pesosToCents, centsToPesosInput } from "@/lib/money";
import type { DeliverySlot } from "@/db/schema";
import { createSlot, updateSlot, setSlotActive } from "@/server/actions/settings";

interface Props {
  slots: DeliverySlot[];
}

export function SlotsManager({ slots }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const sorted = useMemo(
    () =>
      [...slots].sort(
        (a, b) => a.sortOrder - b.sortOrder || a.startTime.localeCompare(b.startTime),
      ),
    [slots],
  );

  function onToggleActive(id: string, isActive: boolean) {
    setTogglingId(id);
    startTransition(async () => {
      const result = await setSlotActive(id, isActive);
      setTogglingId(null);
      if (result.ok) {
        toast.success(isActive ? "Franja activada" : "Franja desactivada");
        router.refresh();
        return;
      }
      toast.error(result.error);
    });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="space-y-1.5">
          <CardTitle>Franjas horarias</CardTitle>
          <CardDescription>
            Configure las franjas de entrega y su capacidad.
          </CardDescription>
        </div>
        <SlotDialog
          mode="create"
          trigger={
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Nueva franja
            </Button>
          }
        />
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Etiqueta</TableHead>
              <TableHead className="w-36">Horario</TableHead>
              <TableHead className="w-28 text-center">Capacidad</TableHead>
              <TableHead className="w-32 text-right">Costo envío</TableHead>
              <TableHead className="w-24 text-center">Activa</TableHead>
              <TableHead className="w-20 text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center text-sm text-muted-foreground"
                >
                  No hay franjas horarias. Cree la primera.
                </TableCell>
              </TableRow>
            )}
            {sorted.map((slot) => (
              <TableRow
                key={slot.id}
                className={cn(!slot.isActive && "opacity-50")}
              >
                <TableCell className="font-medium">
                  <span className="inline-flex items-center gap-2">
                    {slot.label}
                    {!slot.isActive && <Badge variant="secondary">Inactiva</Badge>}
                  </span>
                </TableCell>
                <TableCell className="tabular-nums">
                  {trimTime(slot.startTime)} – {trimTime(slot.endTime)}
                </TableCell>
                <TableCell className="text-center tabular-nums">
                  {slot.capacityLimit}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatArs(slot.shippingCostCents)}
                </TableCell>
                <TableCell className="text-center">
                  <Switch
                    checked={slot.isActive}
                    disabled={pending && togglingId === slot.id}
                    onCheckedChange={(v) => onToggleActive(slot.id, v)}
                    aria-label="Activar franja"
                  />
                </TableCell>
                <TableCell className="text-right">
                  <SlotDialog
                    mode="edit"
                    slot={slot}
                    trigger={
                      <Button variant="ghost" size="icon" aria-label="Editar">
                        <Pencil className="h-4 w-4" />
                      </Button>
                    }
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function SlotDialog({
  mode,
  slot,
  trigger,
}: {
  mode: "create" | "edit";
  slot?: DeliverySlot;
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const [label, setLabel] = useState(slot?.label ?? "");
  const [startTime, setStartTime] = useState(
    slot ? trimTime(slot.startTime) : "",
  );
  const [endTime, setEndTime] = useState(slot ? trimTime(slot.endTime) : "");
  const [capacityLimit, setCapacityLimit] = useState(
    String(slot?.capacityLimit ?? 6),
  );
  const [shippingCost, setShippingCost] = useState(
    centsToPesosInput(slot?.shippingCostCents ?? 0),
  );
  const [sortOrder, setSortOrder] = useState(String(slot?.sortOrder ?? 0));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  function reset() {
    setLabel(slot?.label ?? "");
    setStartTime(slot ? trimTime(slot.startTime) : "");
    setEndTime(slot ? trimTime(slot.endTime) : "");
    setCapacityLimit(String(slot?.capacityLimit ?? 6));
    setShippingCost(centsToPesosInput(slot?.shippingCostCents ?? 0));
    setSortOrder(String(slot?.sortOrder ?? 0));
    setFieldErrors({});
  }

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) reset();
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    const shippingCostCents = pesosToCents(shippingCost) ?? 0;
    startTransition(async () => {
      const payload = {
        label,
        startTime,
        endTime,
        capacityLimit: Number(capacityLimit),
        shippingCostCents,
        sortOrder: Number(sortOrder),
      };
      const result =
        mode === "create"
          ? await createSlot({ ...payload, isActive: true })
          : await updateSlot(slot!.id, payload);

      if (result.ok) {
        toast.success(mode === "create" ? "Franja creada" : "Franja actualizada");
        setOpen(false);
        router.refresh();
        return;
      }
      if (result.fieldErrors) setFieldErrors(result.fieldErrors);
      toast.error(result.error);
    });
  }

  const err = (field: string) => fieldErrors[field]?.[0];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>
              {mode === "create" ? "Nueva franja" : "Editar franja"}
            </DialogTitle>
            <DialogDescription>
              {mode === "create"
                ? "Agregue una nueva franja horaria de entrega."
                : "Modifique los datos de la franja horaria."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="slot-label">Etiqueta</Label>
              <Input
                id="slot-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Mediodía"
                autoFocus
              />
              {err("label") && (
                <p className="text-sm font-medium text-destructive">{err("label")}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="slot-start">Hora de inicio</Label>
                <Input
                  id="slot-start"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
                {err("startTime") && (
                  <p className="text-sm font-medium text-destructive">
                    {err("startTime")}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="slot-end">Hora de fin</Label>
                <Input
                  id="slot-end"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
                {err("endTime") && (
                  <p className="text-sm font-medium text-destructive">
                    {err("endTime")}
                  </p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="slot-capacity">Capacidad</Label>
                <Input
                  id="slot-capacity"
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={capacityLimit}
                  onChange={(e) => setCapacityLimit(e.target.value)}
                />
                {err("capacityLimit") && (
                  <p className="text-sm font-medium text-destructive">
                    {err("capacityLimit")}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="slot-shipping-cost">Costo de envío (ARS)</Label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    $
                  </span>
                  <Input
                    id="slot-shipping-cost"
                    inputMode="decimal"
                    className="pl-7 tabular-nums"
                    value={shippingCost}
                    onChange={(e) => setShippingCost(e.target.value)}
                    placeholder="2000"
                  />
                </div>
                {err("shippingCostCents") && (
                  <p className="text-sm font-medium text-destructive">
                    {err("shippingCostCents")}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="slot-sort">Orden de visualización</Label>
                <Input
                  id="slot-sort"
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                />
                {err("sortOrder") && (
                  <p className="text-sm font-medium text-destructive">
                    {err("sortOrder")}
                  </p>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost" disabled={pending}>
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
