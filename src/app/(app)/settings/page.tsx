import { getAllBrothTypes, getAllSlots } from "@/server/queries";
import { getSettings } from "@/server/settings";

import { PageHeader } from "@/components/page-header";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

import { CapacityForm } from "@/components/settings/capacity-form";
import { DeliveryDaysForm } from "@/components/settings/delivery-days-form";
import { BrothTypesManager } from "@/components/settings/broth-types-manager";
import { SlotsManager } from "@/components/settings/slots-manager";
import { OriginForm } from "@/components/settings/origin-form";
import { SearchAreaForm } from "@/components/settings/search-area-form";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [settings, brothTypes, slots] = await Promise.all([
    getSettings(),
    getAllBrothTypes(),
    getAllSlots(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Configuración"
        description="Gestione la capacidad de producción, los productos y los días y franjas de entrega."
      />

      <Tabs defaultValue="capacity" className="space-y-6">
        <TabsList>
          <TabsTrigger value="capacity">Capacidad</TabsTrigger>
          <TabsTrigger value="delivery-days">Días de entrega</TabsTrigger>
          <TabsTrigger value="broth-types">Tipos de caldo</TabsTrigger>
          <TabsTrigger value="slots">Franjas horarias</TabsTrigger>
          <TabsTrigger value="origin">Origen de reparto</TabsTrigger>
          <TabsTrigger value="search-area">Área de búsqueda</TabsTrigger>
        </TabsList>

        <TabsContent value="capacity">
          <CapacityForm
            defaultDailyCapacity={settings.defaultDailyCapacity}
            defaultSlotCapacity={settings.defaultSlotCapacity}
          />
        </TabsContent>

        <TabsContent value="delivery-days">
          <DeliveryDaysForm activeDeliveryDays={settings.activeDeliveryDays} />
        </TabsContent>

        <TabsContent value="broth-types">
          <BrothTypesManager brothTypes={brothTypes} />
        </TabsContent>

        <TabsContent value="slots">
          <SlotsManager slots={slots} />
        </TabsContent>

        <TabsContent value="origin">
          <OriginForm
            originAddress={settings.originAddress}
            originLat={settings.originLat}
            originLng={settings.originLng}
          />
        </TabsContent>

        <TabsContent value="search-area">
          <SearchAreaForm
            searchLabel={settings.searchLabel}
            searchCenterLat={settings.searchCenterLat}
            searchCenterLng={settings.searchCenterLng}
            searchRadiusKm={settings.searchRadiusKm}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
