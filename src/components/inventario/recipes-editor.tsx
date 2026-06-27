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
import { formatArs } from "@/lib/money";
import { setRecipeItem, deleteRecipeItem } from "@/server/actions/inventory";

export interface RecipeProduct {
  id: string;
  name: string;
  costCents: number;
  recipe: { id: string; ingredientId: string; qtyPerUnitBase: number }[];
}
export interface RecipeIngredient {
  id: string;
  name: string;
  baseUnit: string;
}

export function RecipesEditor({
  products,
  ingredients,
}: {
  products: RecipeProduct[];
  ingredients: RecipeIngredient[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [ingredientId, setIngredientId] = useState("");
  const [qty, setQty] = useState("");

  const product = products.find((p) => p.id === productId);
  const ingMap = useMemo(() => new Map(ingredients.map((i) => [i.id, i])), [ingredients]);

  function add(e: React.FormEvent) {
    e.preventDefault();
    if (!productId || !ingredientId || !qty) {
      toast.error("Elegí insumo y cantidad.");
      return;
    }
    startTransition(async () => {
      const r = await setRecipeItem({ productId, ingredientId, qtyPerUnitBase: Number(qty) });
      if (r.ok) {
        toast.success("Receta actualizada");
        setIngredientId("");
        setQty("");
        router.refresh();
        return;
      }
      toast.error(r.error);
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const r = await deleteRecipeItem(id);
      if (r.ok) {
        toast.success("Insumo quitado de la receta");
        router.refresh();
      } else toast.error(r.error);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recetas</CardTitle>
        <CardDescription>
          Definí cuánto de cada insumo consume un producto (en su unidad base). El costo
          del producto se calcula solo a partir de la receta y el costo de los insumos.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Producto</Label>
          <Select value={productId} onValueChange={setProductId}>
            <SelectTrigger className="max-w-sm"><SelectValue placeholder="Elegí un producto" /></SelectTrigger>
            <SelectContent>
              {products.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {product && (
          <>
            <div className="rounded-md border bg-muted/30 p-3 text-sm">
              Costo calculado de <strong>{product.name}</strong>:{" "}
              <span className="font-semibold tabular-nums">{formatArs(product.costCents)}</span>
              {product.recipe.length === 0 && (
                <span className="text-muted-foreground"> — sin receta aún (usa el costo manual).</span>
              )}
            </div>

            <ul className="space-y-1.5">
              {product.recipe.map((r) => {
                const ing = ingMap.get(r.ingredientId);
                return (
                  <li key={r.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                    <span>
                      <span className="font-medium">{ing?.name ?? "—"}</span>{" "}
                      <span className="tabular-nums text-muted-foreground">
                        {r.qtyPerUnitBase} {ing?.baseUnit}
                      </span>
                    </span>
                    <Button variant="ghost" size="icon" disabled={pending} onClick={() => remove(r.id)} aria-label="Quitar">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </li>
                );
              })}
            </ul>

            <form onSubmit={add} className="flex flex-wrap items-end gap-2">
              <div className="min-w-[12rem] flex-1 space-y-1">
                <Label className="text-xs">Insumo</Label>
                <Select value={ingredientId} onValueChange={setIngredientId}>
                  <SelectTrigger><SelectValue placeholder="Elegí insumo" /></SelectTrigger>
                  <SelectContent>
                    {ingredients.map((i) => (
                      <SelectItem key={i.id} value={i.id}>{i.name} ({i.baseUnit})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-32 space-y-1">
                <Label className="text-xs">Cantidad ({ingMap.get(ingredientId)?.baseUnit ?? "base"})</Label>
                <Input type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} placeholder="200" />
              </div>
              <Button type="submit" disabled={pending}>
                {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                Agregar
              </Button>
            </form>
          </>
        )}
      </CardContent>
    </Card>
  );
}
