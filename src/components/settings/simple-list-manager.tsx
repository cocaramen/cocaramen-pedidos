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
import type { ActionResult } from "@/lib/action-result";

export interface SimpleItem {
  id: string;
  name: string;
  isActive: boolean;
  sortOrder: number;
}

interface Input {
  name: string;
  isActive?: boolean;
  sortOrder: number;
}

interface Props {
  title: string;
  description: string;
  addLabel: string;
  emptyLabel: string;
  namePlaceholder: string;
  noun: string; // e.g. "forma de pago" — used in toasts
  items: SimpleItem[];
  createAction: (input: Input) => Promise<ActionResult<{ id: string }>>;
  updateAction: (id: string, input: Partial<Input>) => Promise<ActionResult>;
  toggleAction: (id: string, isActive: boolean) => Promise<ActionResult>;
}

export function SimpleListManager({
  title,
  description,
  addLabel,
  emptyLabel,
  namePlaceholder,
  noun,
  items,
  createAction,
  updateAction,
  toggleAction,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const sorted = useMemo(
    () =>
      [...items].sort(
        (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
      ),
    [items],
  );

  function onToggleActive(id: string, isActive: boolean) {
    setTogglingId(id);
    startTransition(async () => {
      const result = await toggleAction(id, isActive);
      setTogglingId(null);
      if (result.ok) {
        toast.success(isActive ? "Activado" : "Desactivado");
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
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        <ItemDialog
          mode="create"
          noun={noun}
          namePlaceholder={namePlaceholder}
          createAction={createAction}
          updateAction={updateAction}
          trigger={
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              {addLabel}
            </Button>
          }
        />
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead className="w-24 text-center">Orden</TableHead>
              <TableHead className="w-24 text-center">Activo</TableHead>
              <TableHead className="w-20 text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                  {emptyLabel}
                </TableCell>
              </TableRow>
            )}
            {sorted.map((item) => (
              <TableRow key={item.id} className={cn(!item.isActive && "opacity-50")}>
                <TableCell className="font-medium">
                  <span className="inline-flex items-center gap-2">
                    {item.name}
                    {!item.isActive && <Badge variant="secondary">Inactivo</Badge>}
                  </span>
                </TableCell>
                <TableCell className="text-center tabular-nums">{item.sortOrder}</TableCell>
                <TableCell className="text-center">
                  <Switch
                    checked={item.isActive}
                    disabled={pending && togglingId === item.id}
                    onCheckedChange={(v) => onToggleActive(item.id, v)}
                    aria-label="Activar"
                  />
                </TableCell>
                <TableCell className="text-right">
                  <ItemDialog
                    mode="edit"
                    item={item}
                    noun={noun}
                    namePlaceholder={namePlaceholder}
                    createAction={createAction}
                    updateAction={updateAction}
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

function ItemDialog({
  mode,
  item,
  noun,
  namePlaceholder,
  createAction,
  updateAction,
  trigger,
}: {
  mode: "create" | "edit";
  item?: SimpleItem;
  noun: string;
  namePlaceholder: string;
  createAction: Props["createAction"];
  updateAction: Props["updateAction"];
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const [name, setName] = useState(item?.name ?? "");
  const [sortOrder, setSortOrder] = useState(String(item?.sortOrder ?? 0));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  function reset() {
    setName(item?.name ?? "");
    setSortOrder(String(item?.sortOrder ?? 0));
    setFieldErrors({});
  }

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) reset();
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    startTransition(async () => {
      const result =
        mode === "create"
          ? await createAction({ name, isActive: true, sortOrder: Number(sortOrder) })
          : await updateAction(item!.id, { name, sortOrder: Number(sortOrder) });

      if (result.ok) {
        toast.success(mode === "create" ? "Creado" : "Actualizado");
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
              {mode === "create" ? `Nueva ${noun}` : `Editar ${noun}`}
            </DialogTitle>
            <DialogDescription>Nombre y orden de visualización.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="item-name">Nombre</Label>
              <Input
                id="item-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={namePlaceholder}
                autoFocus
              />
              {err("name") && (
                <p className="text-sm font-medium text-destructive">{err("name")}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="item-sort">Orden de visualización</Label>
              <Input
                id="item-sort"
                type="number"
                min={0}
                inputMode="numeric"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
              />
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
