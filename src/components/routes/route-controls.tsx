"use client";

import { useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface SlotOpt {
  id: string;
  label: string;
}

export function RouteControls({
  date,
  slots,
  selected,
}: {
  date: string;
  slots: SlotOpt[];
  selected: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  function push(nextDate: string, nextSlots: string[]) {
    const sp = new URLSearchParams();
    sp.set("date", nextDate);
    sp.set("slots", nextSlots.join(","));
    startTransition(() => router.push(`${pathname}?${sp.toString()}`));
  }

  function toggle(id: string) {
    const next = selected.includes(id)
      ? selected.filter((s) => s !== id)
      : [...selected, id];
    push(date, next);
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-2">
        <label className="text-sm font-medium">Fecha de entrega</label>
        <Input
          type="date"
          value={date}
          onChange={(e) => push(e.target.value, selected)}
          className="w-auto"
        />
      </div>
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          Franjas horarias
          {pending && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        </div>
        <div className="flex flex-wrap gap-2">
          {slots.map((s) => {
            const active = selected.includes(s.id);
            return (
              <Button
                key={s.id}
                type="button"
                size="sm"
                variant={active ? "default" : "outline"}
                onClick={() => toggle(s.id)}
                className={cn(!active && "text-muted-foreground")}
              >
                {s.label}
              </Button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
