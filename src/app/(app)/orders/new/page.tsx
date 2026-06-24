import { getActiveBrothTypes, getActiveSlots } from "@/server/queries";
import { getSettings } from "@/server/settings";
import { nextDeliveryDate } from "@/lib/dates";
import { OrderForm } from "@/components/orders/order-form";
import { PageHeader } from "@/components/page-header";

export const dynamic = "force-dynamic";

export default async function NewOrderPage() {
  const [brothTypes, slots, settings] = await Promise.all([
    getActiveBrothTypes(),
    getActiveSlots(),
    getSettings(),
  ]);
  const defaultDate = nextDeliveryDate(settings.activeDeliveryDays);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Nuevo Pedido"
        description="Registre un pedido y revise la capacidad antes de confirmar."
      />
      <OrderForm brothTypes={brothTypes} slots={slots} defaultDate={defaultDate} />
    </div>
  );
}
