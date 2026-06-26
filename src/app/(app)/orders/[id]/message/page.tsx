import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { Pencil } from "lucide-react";

import { getOrderById, getMessageTemplates, getActiveVolumeDiscounts } from "@/server/queries";
import { getBranding } from "@/server/settings";
import { buildOrderVars } from "@/lib/messages";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { OrderMessagePanel } from "@/components/orders/order-message-panel";

export const dynamic = "force-dynamic";

export default async function OrderMessagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [order, templates, volumeDiscounts, branding] = await Promise.all([
    getOrderById(id),
    getMessageTemplates(),
    getActiveVolumeDiscounts(),
    getBranding(),
  ]);
  if (!order) notFound();

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  const publicUrl = `${proto}://${host}/p/${order.publicToken}`;

  const vars = buildOrderVars(order, volumeDiscounts, {
    publicUrl,
    businessName: branding.nameShort,
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title={`Mensajes · ${order.customerName}`}
        description="Generá el mensaje para el cliente y compartí el enlace del pedido."
      >
        <Button asChild variant="outline">
          <Link href={`/orders/${order.id}/edit`}>
            <Pencil className="mr-2 h-4 w-4" />
            Editar pedido
          </Link>
        </Button>
      </PageHeader>

      <OrderMessagePanel
        templates={templates}
        vars={vars}
        phone={order.customerPhone}
        currentStatus={order.status}
        publicUrl={publicUrl}
      />
    </div>
  );
}
