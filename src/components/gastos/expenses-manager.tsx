"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus, Pencil, Trash2 } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { formatArs, pesosToCents, centsToPesosInput } from "@/lib/money";
import { formatShortDate, todayISO } from "@/lib/dates";
import type { Expense } from "@/db/schema";
import { createExpense, updateExpense, deleteExpense } from "@/server/actions/expenses";

interface Props {
  expenses: Expense[];
  totalCents: number;
}

const KIND_LABEL: Record<string, string> = { fixed: "Fijo", variable: "Variable" };

export function ExpensesManager({ expenses, totalCents }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onDelete(id: string) {
    startTransition(async () => {
      const r = await deleteExpense(id);
      if (r.ok) {
        toast.success("Gasto eliminado");
        router.refresh();
      } else toast.error(r.error);
    });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="space-y-1.5">
          <CardTitle>Gastos</CardTitle>
          <CardDescription>
            Gastos operativos (fijos, sueldos, variables en lote). La materia prima que
            entra al inventario va en <strong>Inventario → Compras</strong>, no acá.
          </CardDescription>
        </div>
        <ExpenseDialog mode="create" trigger={<Button size="sm"><Plus className="mr-2 h-4 w-4" />Nuevo gasto</Button>} />
      </CardHeader>
      <CardContent>
        <div className="mb-3 text-sm text-muted-foreground">
          Total del período: <span className="font-semibold tabular-nums text-foreground">{formatArs(totalCents)}</span>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Proveedor</TableHead>
              <TableHead className="text-right">Monto</TableHead>
              <TableHead className="w-20 text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {expenses.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                  No hay gastos registrados.
                </TableCell>
              </TableRow>
            )}
            {expenses.map((e) => (
              <TableRow key={e.id}>
                <TableCell className="whitespace-nowrap text-sm">{formatShortDate(e.expenseDate)}</TableCell>
                <TableCell>{e.category}</TableCell>
                <TableCell><Badge variant="outline">{KIND_LABEL[e.kind]}</Badge></TableCell>
                <TableCell className="text-sm text-muted-foreground">{e.vendor ?? "—"}</TableCell>
                <TableCell className="text-right font-medium tabular-nums">{formatArs(e.amountCents)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end">
                    <ExpenseDialog
                      mode="edit"
                      expense={e}
                      trigger={<Button variant="ghost" size="icon" aria-label="Editar"><Pencil className="h-4 w-4" /></Button>}
                    />
                    <Button variant="ghost" size="icon" aria-label="Eliminar" disabled={pending} onClick={() => onDelete(e.id)}>
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

function ExpenseDialog({
  mode,
  expense,
  trigger,
}: {
  mode: "create" | "edit";
  expense?: Expense;
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const [date, setDate] = useState(expense?.expenseDate ?? todayISO());
  const [amount, setAmount] = useState(centsToPesosInput(expense?.amountCents ?? 0));
  const [category, setCategory] = useState(expense?.category ?? "");
  const [kind, setKind] = useState(expense?.kind ?? "variable");
  const [vendor, setVendor] = useState(expense?.vendor ?? "");
  const [notes, setNotes] = useState(expense?.notes ?? "");
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  function reset() {
    setDate(expense?.expenseDate ?? todayISO());
    setAmount(centsToPesosInput(expense?.amountCents ?? 0));
    setCategory(expense?.category ?? "");
    setKind(expense?.kind ?? "variable");
    setVendor(expense?.vendor ?? "");
    setNotes(expense?.notes ?? "");
    setErrors({});
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    const amountCents = pesosToCents(amount);
    if (amountCents === null || amountCents <= 0) {
      setErrors({ amountCents: ["Ingrese un monto válido."] });
      return;
    }
    startTransition(async () => {
      const payload = { expenseDate: date, amountCents, category, kind, vendor, notes };
      const r = mode === "create" ? await createExpense(payload) : await updateExpense(expense!.id, payload);
      if (r.ok) {
        toast.success(mode === "create" ? "Gasto registrado" : "Gasto actualizado");
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
            <DialogTitle>{mode === "create" ? "Nuevo gasto" : "Editar gasto"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="exp-date">Fecha</Label>
                <Input id="exp-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="exp-amount">Monto (ARS)</Label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                  <Input id="exp-amount" inputMode="decimal" className="pl-7 tabular-nums" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="10000" />
                </div>
                {err("amountCents") && <p className="text-sm font-medium text-destructive">{err("amountCents")}</p>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="exp-cat">Categoría</Label>
                <Input id="exp-cat" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Alquiler, gas, sueldos…" list="exp-cats" />
                <datalist id="exp-cats">
                  {["Alquiler", "Servicios", "Sueldos", "Gas", "Descartables", "Marketing", "Otros"].map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
                {err("category") && <p className="text-sm font-medium text-destructive">{err("category")}</p>}
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={kind} onValueChange={(v) => setKind(v as "fixed" | "variable")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="variable">Variable</SelectItem>
                    <SelectItem value="fixed">Fijo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="exp-vendor">Proveedor (opcional)</Label>
              <Input id="exp-vendor" value={vendor} onChange={(e) => setVendor(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="exp-notes">Notas (opcional)</Label>
              <Textarea id="exp-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
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
