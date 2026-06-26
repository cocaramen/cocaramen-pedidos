import { notFound } from "next/navigation";
import { headers } from "next/headers";
import {
  getOrderById,
  getActiveProducts,
  getActiveSlots,
  getActiveVolumeDiscounts,
  getActivePaymentMethods,
  getActiveShippingMethods,
  getMessageTemplates,
} from "@/server/queries";
import { getSettings } from "@/server/settings";
import { nextDeliveryDate } from "@/lib/dates";
import { buildOrderVars } from "@/lib/messages";
import { OrderForm, type OrderFormInitial } from "@/components/orders/order-form";
import { OrderMessagePanel } from "@/components/orders/order-message-panel";
import { PageHeader } from "@/components/page-header";
import { DeleteOrderButton } from "@/components/orders/delete-order-button";
import type { Product, DeliverySlot } from "@/db/schema";

export const dynamic = "force-dynamic";

export default async function EditOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [
    order,
    activeProducts,
    activeSlots,
    volumeDiscounts,
    paymentMethods,
    shippingMethods,
    templates,
    settings,
  ] = await Promise.all([
    getOrderById(id),
    getActiveProducts(),
    getActiveSlots(),
    getActiveVolumeDiscounts(),
    getActivePaymentMethods(),
    getActiveShippingMethods(),
    getMessageTemplates(),
    getSettings(),
  ]);

  if (!order) notFound();

  // Ensure products / slots referenced by this order remain selectable
  // even if they were since deactivated.
  const productMap = new Map<string, Product>(activeProducts.map((p) => [p.id, p]));
  for (const item of order.items) {
    if (item.product && !productMap.has(item.product.id)) {
      productMap.set(item.product.id, item.product);
    }
  }
  const slotMap = new Map<string, DeliverySlot>(activeSlots.map((s) => [s.id, s]));
  if (order.slot && !slotMap.has(order.slot.id)) slotMap.set(order.slot.id, order.slot);

  const initial: OrderFormInitial = {
    id: order.id,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    customerAddress: order.customerAddress,
    latitude: order.latitude,
    longitude: order.longitude,
    customerNotes: order.customerNotes,
    internalNotes: order.internalNotes,
    trackingUrl: order.trackingUrl,
    fulfillmentType: order.fulfillmentType,
    paymentMethodId: order.paymentMethodId,
    shippingMethodId: order.shippingMethodId,
    deliveryDate: order.deliveryDate,
    deliverySlotId: order.deliverySlotId,
    status: order.status,
    items: order.items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
  };

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  const publicUrl = `${proto}://${host}/p/${order.publicToken}`;

  const messageVars = buildOrderVars(order, volumeDiscounts, { publicUrl });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title={`Editar Pedido · ${order.customerName}`}
        description="Modifique los datos. La capacidad se recalcula sin contar este pedido dos veces."
      >
        <DeleteOrderButton orderId={order.id} />
      </PageHeader>
      <OrderForm
        products={[...productMap.values()]}
        volumeDiscounts={volumeDiscounts}
        slots={[...slotMap.values()]}
        paymentMethods={paymentMethods}
        shippingMethods={shippingMethods}
        defaultDate={nextDeliveryDate(settings.activeDeliveryDays)}
        initial={initial}
        searchArea={{
          lat: settings.searchCenterLat,
          lng: settings.searchCenterLng,
          radiusKm: settings.searchRadiusKm,
          label: settings.searchLabel,
        }}
      />
      <OrderMessagePanel
        templates={templates}
        vars={messageVars}
        phone={order.customerPhone}
        currentStatus={order.status}
        publicUrl={publicUrl}
      />
    </div>
  );
}
