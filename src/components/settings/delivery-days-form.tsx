"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

import { DELIVERY_DAYS } from "@/lib/validation";
import { WEEKDAY_LABELS_ES } from "@/lib/dates";
import { updateDeliveryDays } from "@/server/actions/settings";

interface Props {
  activeDeliveryDays: string[];
}

export function DeliveryDaysForm({ activeDeliveryDays }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(activeDeliveryDays),
  );

  function toggle(day: string, value: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (value) next.add(day);
      else next.delete(day);
      return next;
    });
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const activeDeliveryDays = DELIVERY_DAYS.filter((d) => selected.has(d));
      const result = await updateDeliveryDays({ activeDeliveryDays });
      if (result.ok) {
        toast.success("Días de entrega actualizados");
        router.refresh();
        return;
      }
      toast.error(result.error);
    });
  }

  return (
    <Card>
      <form onSubmit={onSubmit}>
        <CardHeader>
          <CardTitle>Días de entrega</CardTitle>
          <CardDescription>
            Seleccione los días de la semana en los que se realizan entregas.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {DELIVERY_DAYS.map((day) => (
            <div
              key={day}
              className="flex items-center justify-between rounded-lg border p-3"
            >
              <Label htmlFor={`day-${day}`} className="cursor-pointer">
                {WEEKDAY_LABELS_ES[day]}
              </Label>
              <Switch
                id={`day-${day}`}
                checked={selected.has(day)}
                onCheckedChange={(v) => toggle(day, v)}
              />
            </div>
          ))}
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
