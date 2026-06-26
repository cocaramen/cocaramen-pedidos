import {
  getActiveProducts,
  getActiveSlots,
  getActivePaymentMethods,
  getActiveVolumeDiscounts,
  getBowlsByDateSlot,
} from "@/server/queries";
import { getSettings, getBranding } from "@/server/settings";
import { upcomingDeliveryDates, formatLongDate, trimTime } from "@/lib/dates";
import { PublicOrderForm, type DayOption } from "@/components/public/public-order-form";

export const dynamic = "force-dynamic";

function Shell({
  branding,
  children,
}: {
  branding: { name: string; logo: string | null; description: string };
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-muted/40 px-4 py-8">
      <div className="mx-auto w-full max-w-lg space-y-4">
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="relative h-16 w-16 overflow-hidden rounded-full shadow-md">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={branding.logo ?? "/logo.png"}
              alt={branding.name}
              className="h-full w-full object-cover"
            />
          </span>
          <div>
            <h1 className="text-xl font-bold">{branding.name}</h1>
            <p className="text-sm text-muted-foreground">Hacé tu pedido</p>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

export default async function PublicOrderPage() {
  const [branding, products, slots, paymentMethods, discounts, settings] =
    await Promise.all([
      getBranding(),
      getActiveProducts(),
      getActiveSlots(),
      getActivePaymentMethods(),
      getActiveVolumeDiscounts(),
      getSettings(),
    ]);

  const dates = upcomingDeliveryDates(settings.activeDeliveryDays, 4);
  const usage = await getBowlsByDateSlot(dates);

  // used bowls per `${date}|${slotId}` and per date (daily)
  const slotUsed = new Map<string, number>();
  const dailyUsed = new Map<string, number>();
  for (const u of usage) {
    slotUsed.set(`${u.date}|${u.slotId}`, u.bowls);
    dailyUsed.set(u.date, (dailyUsed.get(u.date) ?? 0) + u.bowls);
  }

  const maxSlot = settings.maxSlotCapacity;
  const maxDaily = settings.maxDailyCapacity;

  const days: DayOption[] = dates.map((date) => {
    const dUsed = dailyUsed.get(date) ?? 0;
    return {
      date,
      label: formatLongDate(date),
      dailySoftRemaining: Math.max(0, settings.defaultDailyCapacity - dUsed),
      dailyHardRemaining: maxDaily > 0 ? Math.max(0, maxDaily - dUsed) : null,
      slots: slots.map((s) => {
        const used = slotUsed.get(`${date}|${s.id}`) ?? 0;
        return {
          id: s.id,
          label: s.label,
          time: `${trimTime(s.startTime)}–${trimTime(s.endTime)}`,
          softRemaining: Math.max(0, s.capacityLimit - used),
          hardRemaining: maxSlot > 0 ? Math.max(0, maxSlot - used) : null,
        };
      }),
    };
  });

  const canOrder = products.length > 0 && days.length > 0 && paymentMethods.length > 0;

  return (
    <Shell branding={branding}>
      {canOrder ? (
        <PublicOrderForm
          products={products.map((p) => ({
            id: p.id,
            name: p.name,
            priceCents: p.priceCents,
            category: p.category,
          }))}
          paymentMethods={paymentMethods.map((m) => ({ id: m.id, name: m.name }))}
          discounts={discounts.map((d) => ({
            category: d.category,
            minQuantity: d.minQuantity,
            discountBps: d.discountBps,
          }))}
          days={days}
        />
      ) : (
        <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
          Por el momento no estamos tomando pedidos online. Escribinos y te
          ayudamos. ¡Gracias!
        </div>
      )}
    </Shell>
  );
}
