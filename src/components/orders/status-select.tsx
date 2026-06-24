"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  STATUS_LABELS,
  STATUS_BADGE_CLASSES,
  ORDER_STATUSES,
  canTransition,
} from "@/lib/order-status";
import { updateOrderStatus } from "@/server/actions/orders";
import type { OrderStatus } from "@/db/schema";

export function StatusSelect({
  orderId,
  status,
}: {
  orderId: string;
  status: OrderStatus;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onChange(next: string) {
    if (next === status) return;
    startTransition(async () => {
      const result = await updateOrderStatus(orderId, next);
      if (result.ok) {
        toast.success(`Estado: ${STATUS_LABELS[next as OrderStatus]}`);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Select value={status} onValueChange={onChange} disabled={pending}>
      <SelectTrigger
        className={cn(
          "h-8 w-[150px] border font-medium",
          STATUS_BADGE_CLASSES[status],
          pending && "opacity-60",
        )}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {ORDER_STATUSES.map((s) => {
          const allowed = canTransition(status, s);
          return (
            <SelectItem key={s} value={s} disabled={!allowed}>
              {STATUS_LABELS[s]}
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
