import { cn } from "@/lib/utils";
import { STATUS_LABELS, STATUS_BADGE_CLASSES } from "@/lib/order-status";
import type { OrderStatus } from "@/db/schema";

export function StatusBadge({ status, className }: { status: OrderStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        STATUS_BADGE_CLASSES[status],
        className,
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
