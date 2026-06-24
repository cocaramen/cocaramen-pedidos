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
import type { BrothType } from "@/db/schema";
import {
  createBrothType,
  updateBrothType,
  setBrothTypeActive,
} from "@/server/actions/settings";

interface Props {
  brothTypes: BrothType[];
}

export function BrothTypesManager({ brothTypes }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const sorted = useMemo(
    () =>
      [...brothTypes].sort(
        (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
      ),
    [brothTypes],
  );

  function onToggleActive(id: string, isActive: boolean) {
    setTogglingId(id);
    startTransition(async () => {
      const result = await setBrothTypeActive(id, isActive);
      setTogglingId(null);
      if (result.ok) {
        toast.success(isActive ? "Caldo activado" : "Caldo desactivado");
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
          <CardTitle>Tipos de caldo</CardTitle>
          <CardDescription>
            Administre los tipos de caldo disponibles para los pedidos.
          </CardDescription>
        </div>
        <BrothTypeDialog
          mode="create"
          trigger={
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Nuevo tipo de caldo
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
                <TableCell
                  colSpan={4}
                  className="text-center text-sm text-muted-foreground"
                >
                  No hay tipos de caldo. Cree el primero.
                </TableCell>
              </TableRow>
            )}
            {sorted.map((broth) => (
              <TableRow
                key={broth.id}
                className={cn(!broth.isActive && "opacity-50")}
              >
                <TableCell className="font-medium">
                  <span className="inline-flex items-center gap-2">
                    {broth.name}
                    {!broth.isActive && (
                      <Badge variant="secondary">Inactivo</Badge>
                    )}
                  </span>
                </TableCell>
                <TableCell className="text-center tabular-nums">
                  {broth.sortOrder}
                </TableCell>
                <TableCell className="text-center">
                  <Switch
                    checked={broth.isActive}
                    disabled={pending && togglingId === broth.id}
                    onCheckedChange={(v) => onToggleActive(broth.id, v)}
                    aria-label="Activar caldo"
                  />
                </TableCell>
                <TableCell className="text-right">
                  <BrothTypeDialog
                    mode="edit"
                    brothType={broth}
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

function BrothTypeDialog({
  mode,
  brothType,
  trigger,
}: {
  mode: "create" | "edit";
  brothType?: BrothType;
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const [name, setName] = useState(brothType?.name ?? "");
  const [sortOrder, setSortOrder] = useState(String(brothType?.sortOrder ?? 0));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  function reset() {
    setName(brothType?.name ?? "");
    setSortOrder(String(brothType?.sortOrder ?? 0));
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
          ? await createBrothType({
              name,
              isActive: true,
              sortOrder: Number(sortOrder),
            })
          : await updateBrothType(brothType!.id, {
              name,
              sortOrder: Number(sortOrder),
            });

      if (result.ok) {
        toast.success(mode === "create" ? "Caldo creado" : "Caldo actualizado");
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
              {mode === "create" ? "Nuevo tipo de caldo" : "Editar tipo de caldo"}
            </DialogTitle>
            <DialogDescription>
              {mode === "create"
                ? "Agregue un nuevo tipo de caldo al catálogo."
                : "Modifique el nombre y el orden de visualización."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="broth-name">Nombre</Label>
              <Input
                id="broth-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Tonkotsu"
                autoFocus
              />
              {err("name") && (
                <p className="text-sm font-medium text-destructive">{err("name")}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="broth-sort">Orden de visualización</Label>
              <Input
                id="broth-sort"
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
