"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
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
import { formatArs, pesosToCents } from "@/lib/money";
import { formatShortDate, todayISO } from "@/lib/dates";
import { createPurchase, deletePurchase } from "@/server/actions/inventory";

export interface PurchaseIngredient {
  id: string;
  name: string;
  baseUnit: string;
  purchaseUnitLabel: string;
  purchaseToBase: number;
}
export interface PurchaseRow {
  id: string;
  purchaseDate: string;
  vendor: string | null;
  totalCents: number;
  itemCount: number;
}

interface Line {
  ingredientId: string;
  qtyPurchase: string; // in purchase units
  costPurchase: string; // pesos per purchase unit
}

export function PurchasesManager({
  purchases,
  ingredients,
}: {
  purchases: PurchaseRow[];
  ingredients: PurchaseIngredient[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function remove(id: string) {
    startTransition(async () => {
      const r = await deletePurchase(id);
      if (r.ok) {
        toast.success("Compra eliminada (stock revertido)");
        router.refresh();
      } else toast.error(r.error);
    });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="space-y-1.5">
          <CardTitle>Compras</CardTitle>
          <CardDescription>
            Cada compra suma stock y actualiza el costo promedio. No es un gasto del
            resultado: el costo impacta como COGS cuando se consume en un pedido.
          </CardDescription>
        </div>
        {ingredients.length > 0 && (
          <PurchaseDialog
            ingredients={ingredients}
            trigger={<Button size="sm"><Plus className="mr-2 h-4 w-4" />Nueva compra</Button>}
          />
        )}
      </CardHeader>
      <CardContent>
        {ingredients.length === 0 ? (
          <p className="text-sm text-muted-foreground">Primero creá insumos para poder registrar compras.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Proveedor</TableHead>
                <TableHead className="text-center">Ítems</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {purchases.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                    No hay compras registradas.
                  </TableCell>
                </TableRow>
              )}
              {purchases.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="whitespace-nowrap text-sm">{formatShortDate(p.purchaseDate)}</TableCell>
                  <TableCell className="text-sm">{p.vendor ?? "—"}</TableCell>
                  <TableCell className="text-center tabular-nums">{p.itemCount}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{formatArs(p.totalCents)}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" disabled={pending} onClick={() => remove(p.id)} aria-label="Eliminar">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function PurchaseDialog({ ingredients, trigger }: { ingredients: PurchaseIngredient[]; trigger: React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [date, setDate] = useState(todayISO());
  const [vendor, setVendor] = useState("");
  const [lines, setLines] = useState<Line[]>([{ ingredientId: "", qtyPurchase: "", costPurchase: "" }]);

  const ingMap = useMemo(() => new Map(ingredients.map((i) => [i.id, i])), [ingredients]);

  function reset() {
    setDate(todayISO());
    setVendor("");
    setLines([{ ingredientId: "", qtyPurchase: "", costPurchase: "" }]);
  }

  const total = lines.reduce((s, l) => {
    const c = pesosToCents(l.costPurchase) ?? 0;
    const q = Number(l.qtyPurchase) || 0;
    return s + c * q;
  }, 0);

  function setLine(idx: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const items = lines
      .filter((l) => l.ingredientId && Number(l.qtyPurchase) > 0)
      .map((l) => {
        const ing = ingMap.get(l.ingredientId)!;
        const costPerPurchase = pesosToCents(l.costPurchase) ?? 0;
        return {
          ingredientId: l.ingredientId,
          qtyBase: Math.round(Number(l.qtyPurchase) * ing.purchaseToBase),
          unitCostCents: Math.round(costPerPurchase / ing.purchaseToBase),
        };
      });
    if (items.length === 0) {
      toast.error("Agregá al menos un insumo con cantidad.");
      return;
    }
    startTransition(async () => {
      const r = await createPurchase({ purchaseDate: date, vendor, items });
      if (r.ok) {
        toast.success("Compra registrada");
        setOpen(false);
        router.refresh();
        return;
      }
      toast.error(r.error);
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) reset(); }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-2xl">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Nueva compra</DialogTitle>
            <DialogDescription>Cargá lo comprado en su unidad de compra y el precio por unidad.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="pur-date">Fecha</Label>
                <Input id="pur-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pur-vendor">Proveedor (opcional)</Label>
                <Input id="pur-vendor" value={vendor} onChange={(e) => setVendor(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Insumos</Label>
              {lines.map((l, idx) => {
                const ing = ingMap.get(l.ingredientId);
                return (
                  <div key={idx} className="flex flex-wrap items-end gap-2 rounded-md border p-2">
                    <div className="min-w-[10rem] flex-1">
                      <Select value={l.ingredientId} onValueChange={(v) => setLine(idx, { ingredientId: v })}>
                        <SelectTrigger><SelectValue placeholder="Insumo" /></SelectTrigger>
                        <SelectContent>
                          {ingredients.map((i) => (
                            <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="w-24">
                      <Input
                        type="number"
                        min={0}
                        step="any"
                        value={l.qtyPurchase}
                        onChange={(e) => setLine(idx, { qtyPurchase: e.target.value })}
                        placeholder={ing ? ing.purchaseUnitLabel : "cant."}
                      />
                    </div>
                    <div className="relative w-32">
                      <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                      <Input
                        className="pl-6"
                        inputMode="decimal"
                        value={l.costPurchase}
                        onChange={(e) => setLine(idx, { costPurchase: e.target.value })}
                        placeholder={ing ? `por ${ing.purchaseUnitLabel}` : "precio"}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))}
                      aria-label="Quitar línea"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                );
              })}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setLines((prev) => [...prev, { ingredientId: "", qtyPurchase: "", costPurchase: "" }])}
              >
                <Plus className="mr-2 h-4 w-4" />Agregar insumo
              </Button>
            </div>

            <div className="text-right text-sm">
              Total: <span className="text-lg font-bold tabular-nums">{formatArs(total)}</span>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="ghost" disabled={pending}>Cancelar</Button></DialogClose>
            <Button type="submit" disabled={pending}>{pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Registrar compra</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
