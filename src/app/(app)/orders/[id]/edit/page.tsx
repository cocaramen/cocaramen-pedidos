import { notFound } from "next/navigation";
import { getOrderById, getActiveBrothTypes, getActiveSlots } from "@/server/queries";
import { getSettings } from "@/server/settings";
import { nextDeliveryDate } from "@/lib/dates";
import { OrderForm, type OrderFormInitial } from "@/components/orders/order-form";
import { PageHeader } from "@/components/page-header";
import { DeleteOrderButton } from "@/components/orders/delete-order-button";
import type { BrothType, DeliverySlot } from "@/db/schema";

export const dynamic = "force-dynamic";

export default async function EditOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [order, activeBroths, activeSlots, settings] = await Promise.all([
    getOrderById(id),
    getActiveBrothTypes(),
    getActiveSlots(),
    getSettings(),
  ]);

  if (!order) notFound();

  // Ensure broth types / slots referenced by this order remain selectable
  // even if they were since deactivated.
  const brothMap = new Map<string, BrothType>(activeBroths.map((b) => [b.id, b]));
  for (const item of order.items) {
    if (item.brothType && !brothMap.has(item.brothType.id)) {
      brothMap.set(item.brothType.id, item.brothType);
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
    deliveryDate: order.deliveryDate,
    deliverySlotId: order.deliverySlotId,
    status: order.status,
    items: order.items.map((i) => ({ brothTypeId: i.brothTypeId, quantity: i.quantity })),
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title={`Editar Pedido · ${order.customerName}`}
        description="Modifique los datos. La capacidad se recalcula sin contar este pedido dos veces."
      >
        <DeleteOrderButton orderId={order.id} />
      </PageHeader>
      <OrderForm
        brothTypes={[...brothMap.values()]}
        slots={[...slotMap.values()]}
        defaultDate={nextDeliveryDate(settings.activeDeliveryDays)}
        initial={initial}
      />
    </div>
  );
}
