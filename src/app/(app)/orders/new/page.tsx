import {
  getActiveProducts,
  getActiveSlots,
  getActiveVolumeDiscounts,
  getActivePaymentMethods,
  getActiveShippingMethods,
} from "@/server/queries";
import { getSettings } from "@/server/settings";
import { nextDeliveryDate } from "@/lib/dates";
import { OrderForm } from "@/components/orders/order-form";
import { PageHeader } from "@/components/page-header";

export const dynamic = "force-dynamic";

export default async function NewOrderPage() {
  const [products, slots, volumeDiscounts, paymentMethods, shippingMethods, settings] =
    await Promise.all([
      getActiveProducts(),
      getActiveSlots(),
      getActiveVolumeDiscounts(),
      getActivePaymentMethods(),
      getActiveShippingMethods(),
      getSettings(),
    ]);
  const defaultDate = nextDeliveryDate(settings.activeDeliveryDays);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Nuevo Pedido"
        description="Registre un pedido y revise la capacidad antes de confirmar."
      />
      <OrderForm
        products={products}
        volumeDiscounts={volumeDiscounts}
        slots={slots}
        paymentMethods={paymentMethods}
        shippingMethods={shippingMethods}
        defaultDate={defaultDate}
        searchArea={{
          lat: settings.searchCenterLat,
          lng: settings.searchCenterLng,
          radiusKm: settings.searchRadiusKm,
          label: settings.searchLabel,
        }}
      />
    </div>
  );
}
