"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, CheckCircle2, Circle } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatArs } from "@/lib/money";
import { setOrderPaid } from "@/server/actions/orders";

interface Props {
  orderId: string;
  totalCents: number;
  paidAtISO: string | null;
}

export function OrderPaymentStatus({ orderId, totalCents, paidAtISO }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [paid, setPaid] = useState(Boolean(paidAtISO));

  function toggle(next: boolean) {
    startTransition(async () => {
      const result = await setOrderPaid(orderId, next);
      if (result.ok) {
        setPaid(next);
        toast.success(next ? "Marcado como pagado" : "Marcado como pendiente");
        router.refresh();
        return;
      }
      toast.error(result.error);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Cobro</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-2xl font-bold tabular-nums">{formatArs(totalCents)}</div>
          <div
            className={
              paid ? "text-sm font-medium text-success" : "text-sm text-muted-foreground"
            }
          >
            {paid ? (
              <span className="inline-flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4" /> Pagado
              </span>
            ) : (
              <span className="inline-flex items-center gap-1">
                <Circle className="h-4 w-4" /> Pendiente de pago
              </span>
            )}
          </div>
        </div>
        <Button
          type="button"
          variant={paid ? "outline" : "default"}
          disabled={pending}
          onClick={() => toggle(!paid)}
        >
          {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {paid ? "Marcar pendiente" : "Marcar pagado"}
        </Button>
      </CardContent>
    </Card>
  );
}
