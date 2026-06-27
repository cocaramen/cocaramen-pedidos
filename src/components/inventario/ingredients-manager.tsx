"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus, Pencil, Scale, AlertTriangle } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
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
import { cn } from "@/lib/utils";
import { formatArs } from "@/lib/money";
import type { Ingredient } from "@/db/schema";
import {
  createIngredient,
  updateIngredient,
  setIngredientActive,
  adjustStock,
} from "@/server/actions/inventory";

export function IngredientsManager({ ingredients }: { ingredients: Ingredient[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function toggle(id: string, isActive: boolean) {
    startTransition(async () => {
      const r = await setIngredientActive(id, isActive);
      if (r.ok) router.refresh();
      else toast.error(r.error);
    });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="space-y-1.5">
          <CardTitle>Insumos</CardTitle>
          <CardDescription>
            Materia prima e insumos (carne, verduras, envases…). El stock y el costo
            promedio se actualizan con las compras.
          </CardDescription>
        </div>
        <IngredientDialog mode="create" trigger={<Button size="sm"><Plus className="mr-2 h-4 w-4" />Nuevo insumo</Button>} />
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Insumo</TableHead>
              <TableHead className="text-right">Stock</TableHead>
              <TableHead className="text-right">Costo prom.</TableHead>
              <TableHead className="w-20 text-center">Activo</TableHead>
              <TableHead className="w-28 text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ingredients.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                  No hay insumos. Creá el primero.
                </TableCell>
              </TableRow>
            )}
            {ingredients.map((i) => {
              const low = i.minStockBase > 0 && i.stockBase <= i.minStockBase;
              return (
                <TableRow key={i.id} className={cn(!i.isActive && "opacity-50")}>
                  <TableCell className="font-medium">
                    <span className="inline-flex items-center gap-2">
                      {i.name}
                      {low && (
                        <Badge variant="outline" className="border-warning text-warning-foreground">
                          <AlertTriangle className="mr-1 h-3 w-3 text-warning" />Bajo
                        </Badge>
                      )}
                    </span>
                    <div className="text-xs text-muted-foreground">
                      Compra en {i.purchaseUnitLabel} (= {i.purchaseToBase} {i.baseUnit})
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {i.stockBase} {i.baseUnit}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {formatArs(i.avgCostCents * i.purchaseToBase)} / {i.purchaseUnitLabel}
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch checked={i.isActive} disabled={pending} onCheckedChange={(v) => toggle(i.id, v)} aria-label="Activo" />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end">
                      <AdjustDialog ingredient={i} trigger={<Button variant="ghost" size="icon" aria-label="Ajustar stock"><Scale className="h-4 w-4" /></Button>} />
                      <IngredientDialog mode="edit" ingredient={i} trigger={<Button variant="ghost" size="icon" aria-label="Editar"><Pencil className="h-4 w-4" /></Button>} />
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function IngredientDialog({ mode, ingredient, trigger }: { mode: "create" | "edit"; ingredient?: Ingredient; trigger: React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(ingredient?.name ?? "");
  const [baseUnit, setBaseUnit] = useState(ingredient?.baseUnit ?? "g");
  const [purchaseUnitLabel, setPurchaseUnitLabel] = useState(ingredient?.purchaseUnitLabel ?? "kg");
  const [purchaseToBase, setPurchaseToBase] = useState(String(ingredient?.purchaseToBase ?? 1000));
  const [minStockBase, setMinStockBase] = useState(String(ingredient?.minStockBase ?? 0));
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  function reset() {
    setName(ingredient?.name ?? "");
    setBaseUnit(ingredient?.baseUnit ?? "g");
    setPurchaseUnitLabel(ingredient?.purchaseUnitLabel ?? "kg");
    setPurchaseToBase(String(ingredient?.purchaseToBase ?? 1000));
    setMinStockBase(String(ingredient?.minStockBase ?? 0));
    setErrors({});
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    startTransition(async () => {
      const payload = {
        name,
        baseUnit,
        purchaseUnitLabel,
        purchaseToBase: Number(purchaseToBase),
        minStockBase: Number(minStockBase),
        isActive: true,
        sortOrder: ingredient?.sortOrder ?? 0,
      };
      const r = mode === "create" ? await createIngredient(payload) : await updateIngredient(ingredient!.id, payload);
      if (r.ok) {
        toast.success(mode === "create" ? "Insumo creado" : "Insumo actualizado");
        setOpen(false);
        router.refresh();
        return;
      }
      if (r.fieldErrors) setErrors(r.fieldErrors);
      toast.error(r.error);
    });
  }
  const err = (f: string) => errors[f]?.[0];

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) reset(); }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>{mode === "create" ? "Nuevo insumo" : "Editar insumo"}</DialogTitle>
            <DialogDescription>
              La unidad base es la que usás en las recetas. La unidad de compra es como lo comprás.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="ing-name">Nombre</Label>
              <Input id="ing-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Carne, Pollo, Envase…" autoFocus />
              {err("name") && <p className="text-sm font-medium text-destructive">{err("name")}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Unidad base (recetas)</Label>
                <Select value={baseUnit} onValueChange={(v) => setBaseUnit(v as "g" | "ml" | "unit")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="g">Gramos (g)</SelectItem>
                    <SelectItem value="ml">Mililitros (ml)</SelectItem>
                    <SelectItem value="unit">Unidades (u)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ing-min">Stock mínimo ({baseUnit})</Label>
                <Input id="ing-min" type="number" min={0} value={minStockBase} onChange={(e) => setMinStockBase(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ing-punit">Unidad de compra</Label>
                <Input id="ing-punit" value={purchaseUnitLabel} onChange={(e) => setPurchaseUnitLabel(e.target.value)} placeholder="kg, docena, unidad" />
                {err("purchaseUnitLabel") && <p className="text-sm font-medium text-destructive">{err("purchaseUnitLabel")}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="ing-conv">1 {purchaseUnitLabel || "compra"} = ? {baseUnit}</Label>
                <Input id="ing-conv" type="number" min={1} value={purchaseToBase} onChange={(e) => setPurchaseToBase(e.target.value)} />
                {err("purchaseToBase") && <p className="text-sm font-medium text-destructive">{err("purchaseToBase")}</p>}
              </div>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="ghost" disabled={pending}>Cancelar</Button></DialogClose>
            <Button type="submit" disabled={pending}>{pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Guardar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AdjustDialog({ ingredient, trigger }: { ingredient: Ingredient; trigger: React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [counted, setCounted] = useState(String(ingredient.stockBase));
  const [reason, setReason] = useState("");

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const r = await adjustStock({ ingredientId: ingredient.id, countedBase: Number(counted), reason });
      if (r.ok) {
        toast.success("Stock ajustado");
        setOpen(false);
        router.refresh();
        return;
      }
      toast.error(r.error);
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) { setCounted(String(ingredient.stockBase)); setReason(""); } }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Ajustar stock · {ingredient.name}</DialogTitle>
            <DialogDescription>Ingresá el stock real contado (en {ingredient.baseUnit}).</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="adj-count">Stock contado ({ingredient.baseUnit})</Label>
              <Input id="adj-count" type="number" min={0} value={counted} onChange={(e) => setCounted(e.target.value)} autoFocus />
            </div>
            <div className="space-y-2">
              <Label htmlFor="adj-reason">Motivo (opcional)</Label>
              <Input id="adj-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Conteo físico, merma…" />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="ghost" disabled={pending}>Cancelar</Button></DialogClose>
            <Button type="submit" disabled={pending}>{pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Ajustar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
