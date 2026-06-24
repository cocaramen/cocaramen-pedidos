"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Info } from "lucide-react";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { updateCapacitySettings } from "@/server/actions/settings";

interface Props {
  defaultDailyCapacity: number;
  defaultSlotCapacity: number;
}

export function CapacityForm({ defaultDailyCapacity, defaultSlotCapacity }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [dailyCapacity, setDailyCapacity] = useState(String(defaultDailyCapacity));
  const [slotCapacity, setSlotCapacity] = useState(String(defaultSlotCapacity));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    startTransition(async () => {
      const result = await updateCapacitySettings({
        defaultDailyCapacity: Number(dailyCapacity),
        defaultSlotCapacity: Number(slotCapacity),
      });
      if (result.ok) {
        toast.success("Capacidad actualizada");
        router.refresh();
        return;
      }
      if (result.fieldErrors) setFieldErrors(result.fieldErrors);
      toast.error(result.error);
    });
  }

  const err = (field: string) => fieldErrors[field]?.[0];

  return (
    <Card>
      <form onSubmit={onSubmit}>
        <CardHeader>
          <CardTitle>Capacidad de producción</CardTitle>
          <CardDescription>
            Defina los límites de capacidad predeterminados que se usan al evaluar los
            pedidos.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="defaultDailyCapacity">Capacidad diaria</Label>
            <Input
              id="defaultDailyCapacity"
              type="number"
              min={0}
              inputMode="numeric"
              value={dailyCapacity}
              onChange={(e) => setDailyCapacity(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Total de tazones que se pueden preparar por día.
            </p>
            {err("defaultDailyCapacity") && (
              <p className="text-sm font-medium text-destructive">
                {err("defaultDailyCapacity")}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="defaultSlotCapacity">
              Capacidad por franja por defecto
            </Label>
            <Input
              id="defaultSlotCapacity"
              type="number"
              min={0}
              inputMode="numeric"
              value={slotCapacity}
              onChange={(e) => setSlotCapacity(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Tazones por franja horaria de forma predeterminada.
            </p>
            {err("defaultSlotCapacity") && (
              <p className="text-sm font-medium text-destructive">
                {err("defaultSlotCapacity")}
              </p>
            )}
          </div>

          <div className="flex gap-2 rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground sm:col-span-2">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              Estas capacidades son límites flexibles: solo generan advertencias y no
              impiden registrar pedidos.
            </p>
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={pending}>
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar cambios
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
