import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { utilizationPct } from "@/lib/capacity";

export function CapacityMeter({
  label,
  used,
  capacity,
  exceeded,
  className,
}: {
  label: string;
  used: number;
  capacity: number;
  exceeded?: boolean;
  className?: string;
}) {
  const pct = utilizationPct(used, capacity);
  const isOver = exceeded ?? used > capacity;
  const near = !isOver && pct >= 80;

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span
          className={cn(
            "tabular-nums",
            isOver ? "font-semibold text-destructive" : "text-muted-foreground",
          )}
        >
          {used} / {capacity}
        </span>
      </div>
      <Progress
        value={Math.min(pct, 100)}
        indicatorClassName={cn(
          isOver ? "bg-destructive" : near ? "bg-warning" : "bg-success",
        )}
      />
    </div>
  );
}
