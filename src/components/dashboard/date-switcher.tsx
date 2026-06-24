"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";

function toISO(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function fromISO(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

function shiftDays(iso: string, delta: number): string {
  const d = fromISO(iso);
  d.setDate(d.getDate() + delta);
  return toISO(d);
}

export function DateSwitcher({ date }: { date: string }) {
  const router = useRouter();

  function goTo(nextDate: string) {
    router.push(`/?date=${nextDate}`);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-1.5">
      <Button
        variant="outline"
        size="icon"
        aria-label="Día anterior"
        onClick={() => goTo(shiftDays(date, -1))}
      >
        <ChevronLeft />
      </Button>

      <div className="relative flex items-center">
        <CalendarDays className="pointer-events-none absolute left-2.5 size-4 text-muted-foreground" />
        <input
          type="date"
          value={date}
          aria-label="Seleccionar fecha"
          onChange={(e) => {
            if (e.target.value) goTo(e.target.value);
          }}
          className="h-9 rounded-md border border-input bg-background py-2 pl-8 pr-3 text-sm tabular-nums shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>

      <Button
        variant="outline"
        size="icon"
        aria-label="Día siguiente"
        onClick={() => goTo(shiftDays(date, 1))}
      >
        <ChevronRight />
      </Button>

      <Button variant="ghost" size="sm" onClick={() => goTo(toISO(new Date()))}>
        Hoy
      </Button>
    </div>
  );
}
