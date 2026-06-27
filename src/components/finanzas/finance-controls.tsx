"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

interface Props {
  from: string;
  to: string;
  granularity: string;
}

export function FinanceControls({ from, to, granularity }: Props) {
  const router = useRouter();

  function go(nextFrom: string, nextTo: string, g = granularity) {
    router.push(`/finanzas?from=${nextFrom}&to=${nextTo}&g=${g}`);
  }

  function preset(kind: "week" | "month" | "year" | "all") {
    const now = new Date();
    if (kind === "week") {
      const day = (now.getDay() + 6) % 7; // monday=0
      const mon = new Date(now);
      mon.setDate(now.getDate() - day);
      const sun = new Date(mon);
      sun.setDate(mon.getDate() + 6);
      go(ymd(mon), ymd(sun), "day");
    } else if (kind === "month") {
      go(ymd(new Date(now.getFullYear(), now.getMonth(), 1)), ymd(new Date(now.getFullYear(), now.getMonth() + 1, 0)), "week");
    } else if (kind === "year") {
      go(ymd(new Date(now.getFullYear(), 0, 1)), ymd(new Date(now.getFullYear(), 11, 31)), "month");
    } else {
      go("2020-01-01", ymd(now), "month");
    }
  }

  const grans: { key: string; label: string }[] = [
    { key: "day", label: "Día" },
    { key: "week", label: "Semana" },
    { key: "month", label: "Mes" },
    { key: "year", label: "Año" },
  ];

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="flex flex-wrap gap-1">
        <Button variant="outline" size="sm" onClick={() => preset("week")}>
          Esta semana
        </Button>
        <Button variant="outline" size="sm" onClick={() => preset("month")}>
          Este mes
        </Button>
        <Button variant="outline" size="sm" onClick={() => preset("year")}>
          Este año
        </Button>
        <Button variant="outline" size="sm" onClick={() => preset("all")}>
          Todo
        </Button>
      </div>
      <div className="flex items-center gap-1">
        <span className="text-xs text-muted-foreground">Agrupar:</span>
        {grans.map((g) => (
          <Button
            key={g.key}
            variant="ghost"
            size="sm"
            className={cn(g.key === granularity && "bg-accent text-accent-foreground")}
            onClick={() => go(from, to, g.key)}
          >
            {g.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
