"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus, Pencil, Trash2 } from "lucide-react";

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
import type { VolumeDiscount } from "@/db/schema";
import {
  createVolumeDiscount,
  updateVolumeDiscount,
  setVolumeDiscountActive,
  deleteVolumeDiscount,
} from "@/server/actions/settings";

interface Props {
  discounts: VolumeDiscount[];
  categories: string[];
}

const pctFmt = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 });
const bpsToPct = (bps: number) => pctFmt.format(bps / 100);

export function VolumeDiscountsManager({ discounts, categories }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  const sorted = useMemo(
    () =>
      [...discounts].sort(
        (a, b) =>
          a.category.localeCompare(b.category) || a.minQuantity - b.minQuantity,
      ),
    [discounts],
  );

  function onToggleActive(id: string, isActive: boolean) {
    setBusyId(id);
    startTransition(async () => {
      const result = await setVolumeDiscountActive(id, isActive);
      setBusyId(null);
      if (result.ok) {
        toast.success(isActive ? "Descuento activado" : "Descuento desactivado");
        router.refresh();
        return;
      }
      toast.error(result.error);
    });
  }

  function onDelete(id: string) {
    setBusyId(id);
    startTransition(async () => {
      const result = await deleteVolumeDiscount(id);
      setBusyId(null);
      if (result.ok) {
        toast.success("Descuento eliminado");
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
          <CardTitle>Descuentos por cantidad</CardTitle>
          <CardDescription>
            Desde N unidades de una categoría, aplique un % de descuento sobre el
            subtotal de esa categoría. El descuento mezcla sabores (ej. 1 pollo +
            1 picante cuentan como 2).
          </CardDescription>
        </div>
        <DiscountDialog
          mode="create"
          categories={categories}
          trigger={
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Nuevo descuento
            </Button>
          }
        />
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Categoría</TableHead>
              <TableHead className="text-center">Desde (cantidad)</TableHead>
              <TableHead className="text-right">Descuento</TableHead>
              <TableHead className="w-24 text-center">Activo</TableHead>
              <TableHead className="w-24 text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-center text-sm text-muted-foreground"
                >
                  No hay descuentos por cantidad. Cree el primero.
                </TableCell>
              </TableRow>
            )}
            {sorted.map((d) => (
              <TableRow key={d.id} className={cn(!d.isActive && "opacity-50")}>
                <TableCell>
                  <span className="inline-flex items-center gap-2">
                    <Badge variant="outline">{d.category}</Badge>
                    {!d.isActive && <Badge variant="secondary">Inactivo</Badge>}
                  </span>
                </TableCell>
                <TableCell className="text-center tabular-nums">
                  {d.minQuantity}+
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {bpsToPct(d.discountBps)}%
                </TableCell>
                <TableCell className="text-center">
                  <Switch
                    checked={d.isActive}
                    disabled={pending && busyId === d.id}
                    onCheckedChange={(v) => onToggleActive(d.id, v)}
                    aria-label="Activar descuento"
                  />
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end">
                    <DiscountDialog
                      mode="edit"
                      discount={d}
                      categories={categories}
                      trigger={
                        <Button variant="ghost" size="icon" aria-label="Editar">
                          <Pencil className="h-4 w-4" />
                        </Button>
                      }
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Eliminar"
                      disabled={pending && busyId === d.id}
                      onClick={() => onDelete(d.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function DiscountDialog({
  mode,
  discount,
  categories,
  trigger,
}: {
  mode: "create" | "edit";
  discount?: VolumeDiscount;
  categories: string[];
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const [category, setCategory] = useState(discount?.category ?? categories[0] ?? "Ramen");
  const [minQuantity, setMinQuantity] = useState(String(discount?.minQuantity ?? 2));
  const [percent, setPercent] = useState(
    discount ? String(discount.discountBps / 100) : "",
  );
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  function reset() {
    setCategory(discount?.category ?? categories[0] ?? "Ramen");
    setMinQuantity(String(discount?.minQuantity ?? 2));
    setPercent(discount ? String(discount.discountBps / 100) : "");
    setFieldErrors({});
  }

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) reset();
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    const pct = Number(percent.replace(",", "."));
    if (!Number.isFinite(pct) || pct <= 0) {
      setFieldErrors({ discountBps: ["Ingrese un porcentaje válido."] });
      return;
    }
    const discountBps = Math.round(pct * 100);
    startTransition(async () => {
      const payload = {
        category,
        minQuantity: Number(minQuantity),
        discountBps,
      };
      const result =
        mode === "create"
          ? await createVolumeDiscount({ ...payload, isActive: true })
          : await updateVolumeDiscount(discount!.id, payload);

      if (result.ok) {
        toast.success(mode === "create" ? "Descuento creado" : "Descuento actualizado");
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
              {mode === "create" ? "Nuevo descuento por cantidad" : "Editar descuento"}
            </DialogTitle>
            <DialogDescription>
              Desde la cantidad indicada, se aplica el % al subtotal de la categoría.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="discount-category">Categoría</Label>
              <Input
                id="discount-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Ramen"
                list="discount-categories"
                autoFocus
              />
              <datalist id="discount-categories">
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
              {err("category") && (
                <p className="text-sm font-medium text-destructive">{err("category")}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="discount-min">Desde (cantidad)</Label>
                <Input
                  id="discount-min"
                  type="number"
                  min={2}
                  inputMode="numeric"
                  value={minQuantity}
                  onChange={(e) => setMinQuantity(e.target.value)}
                />
                {err("minQuantity") && (
                  <p className="text-sm font-medium text-destructive">
                    {err("minQuantity")}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="discount-pct">Descuento (%)</Label>
                <div className="relative">
                  <Input
                    id="discount-pct"
                    inputMode="decimal"
                    className="pr-7 tabular-nums"
                    value={percent}
                    onChange={(e) => setPercent(e.target.value)}
                    placeholder="6,25"
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    %
                  </span>
                </div>
                {err("discountBps") && (
                  <p className="text-sm font-medium text-destructive">
                    {err("discountBps")}
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
