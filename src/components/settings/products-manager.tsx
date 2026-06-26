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
import { formatArs, pesosToCents, centsToPesosInput } from "@/lib/money";
import type { Product } from "@/db/schema";
import {
  createProduct,
  updateProduct,
  setProductActive,
} from "@/server/actions/settings";

interface Props {
  products: Product[];
}

export function ProductsManager({ products }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const sorted = useMemo(
    () =>
      [...products].sort(
        (a, b) =>
          a.category.localeCompare(b.category) ||
          a.sortOrder - b.sortOrder ||
          a.name.localeCompare(b.name),
      ),
    [products],
  );

  const categories = useMemo(
    () => [...new Set(products.map((p) => p.category))].sort(),
    [products],
  );

  function onToggleActive(id: string, isActive: boolean) {
    setTogglingId(id);
    startTransition(async () => {
      const result = await setProductActive(id, isActive);
      setTogglingId(null);
      if (result.ok) {
        toast.success(isActive ? "Producto activado" : "Producto desactivado");
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
          <CardTitle>Productos</CardTitle>
          <CardDescription>
            Administre los productos disponibles, su categoría y su precio.
          </CardDescription>
        </div>
        <ProductDialog
          mode="create"
          categories={categories}
          trigger={
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Nuevo producto
            </Button>
          }
        />
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead className="w-32 text-right">Precio</TableHead>
              <TableHead className="w-24 text-center">Orden</TableHead>
              <TableHead className="w-24 text-center">Activo</TableHead>
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
                  No hay productos. Cree el primero.
                </TableCell>
              </TableRow>
            )}
            {sorted.map((product) => (
              <TableRow
                key={product.id}
                className={cn(!product.isActive && "opacity-50")}
              >
                <TableCell className="font-medium">
                  <span className="inline-flex items-center gap-2">
                    {product.name}
                    {!product.isActive && (
                      <Badge variant="secondary">Inactivo</Badge>
                    )}
                  </span>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{product.category}</Badge>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatArs(product.priceCents)}
                </TableCell>
                <TableCell className="text-center tabular-nums">
                  {product.sortOrder}
                </TableCell>
                <TableCell className="text-center">
                  <Switch
                    checked={product.isActive}
                    disabled={pending && togglingId === product.id}
                    onCheckedChange={(v) => onToggleActive(product.id, v)}
                    aria-label="Activar producto"
                  />
                </TableCell>
                <TableCell className="text-right">
                  <ProductDialog
                    mode="edit"
                    product={product}
                    categories={categories}
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

function ProductDialog({
  mode,
  product,
  categories,
  trigger,
}: {
  mode: "create" | "edit";
  product?: Product;
  categories: string[];
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const [name, setName] = useState(product?.name ?? "");
  const [category, setCategory] = useState(product?.category ?? "Ramen");
  const [price, setPrice] = useState(centsToPesosInput(product?.priceCents ?? 0));
  const [sortOrder, setSortOrder] = useState(String(product?.sortOrder ?? 0));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  function reset() {
    setName(product?.name ?? "");
    setCategory(product?.category ?? "Ramen");
    setPrice(centsToPesosInput(product?.priceCents ?? 0));
    setSortOrder(String(product?.sortOrder ?? 0));
    setFieldErrors({});
  }

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) reset();
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    const priceCents = pesosToCents(price);
    if (priceCents === null) {
      setFieldErrors({ priceCents: ["Ingrese un precio válido en pesos."] });
      return;
    }
    startTransition(async () => {
      const result =
        mode === "create"
          ? await createProduct({
              name,
              category,
              priceCents,
              isActive: true,
              sortOrder: Number(sortOrder),
            })
          : await updateProduct(product!.id, {
              name,
              category,
              priceCents,
              sortOrder: Number(sortOrder),
            });

      if (result.ok) {
        toast.success(mode === "create" ? "Producto creado" : "Producto actualizado");
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
              {mode === "create" ? "Nuevo producto" : "Editar producto"}
            </DialogTitle>
            <DialogDescription>
              {mode === "create"
                ? "Agregue un nuevo producto al catálogo."
                : "Modifique el nombre, la categoría, el precio y el orden."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="product-name">Nombre</Label>
              <Input
                id="product-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Caldo de Pollo"
                autoFocus
              />
              {err("name") && (
                <p className="text-sm font-medium text-destructive">{err("name")}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="product-category">Categoría</Label>
              <Input
                id="product-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Ramen"
                list="product-categories"
              />
              <datalist id="product-categories">
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
              <p className="text-xs text-muted-foreground">
                Los descuentos por cantidad se aplican por categoría.
              </p>
              {err("category") && (
                <p className="text-sm font-medium text-destructive">{err("category")}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="product-price">Precio (ARS)</Label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  $
                </span>
                <Input
                  id="product-price"
                  inputMode="decimal"
                  className="pl-7 tabular-nums"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="16000"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Precio de venta por unidad, en pesos argentinos.
              </p>
              {err("priceCents") && (
                <p className="text-sm font-medium text-destructive">
                  {err("priceCents")}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="product-sort">Orden de visualización</Label>
              <Input
                id="product-sort"
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
