import {
  getAllProducts,
  getAllSlots,
  getAllVolumeDiscounts,
  getMessageTemplates,
  getAllPaymentMethods,
  getAllShippingMethods,
} from "@/server/queries";
import { getSettings, getBranding } from "@/server/settings";
import {
  createPaymentMethod,
  updatePaymentMethod,
  setPaymentMethodActive,
  createShippingMethod,
  updateShippingMethod,
  setShippingMethodActive,
} from "@/server/actions/settings";

import { PageHeader } from "@/components/page-header";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

import { CapacityForm } from "@/components/settings/capacity-form";
import { DeliveryDaysForm } from "@/components/settings/delivery-days-form";
import { BrandingForm } from "@/components/settings/branding-form";
import { ProductsManager } from "@/components/settings/products-manager";
import { VolumeDiscountsManager } from "@/components/settings/volume-discounts-manager";
import { MessageTemplatesManager } from "@/components/settings/message-templates-manager";
import { SimpleListManager } from "@/components/settings/simple-list-manager";
import { SlotsManager } from "@/components/settings/slots-manager";
import { OriginForm } from "@/components/settings/origin-form";
import { SearchAreaForm } from "@/components/settings/search-area-form";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [
    settings,
    branding,
    products,
    slots,
    volumeDiscounts,
    messageTemplates,
    paymentMethods,
    shippingMethods,
  ] = await Promise.all([
    getSettings(),
    getBranding(),
    getAllProducts(),
    getAllSlots(),
    getAllVolumeDiscounts(),
    getMessageTemplates(),
    getAllPaymentMethods(),
    getAllShippingMethods(),
  ]);

  const categories = [...new Set(products.map((p) => p.category))].sort();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Configuración"
        description="Gestione la capacidad de producción, los productos y los días y franjas de entrega."
      />

      <Tabs defaultValue="branding" className="space-y-6">
        <TabsList>
          <TabsTrigger value="branding">Marca</TabsTrigger>
          <TabsTrigger value="capacity">Capacidad</TabsTrigger>
          <TabsTrigger value="delivery-days">Días de entrega</TabsTrigger>
          <TabsTrigger value="products">Productos</TabsTrigger>
          <TabsTrigger value="discounts">Descuentos</TabsTrigger>
          <TabsTrigger value="messages">Mensajes</TabsTrigger>
          <TabsTrigger value="payments">Pagos</TabsTrigger>
          <TabsTrigger value="shipping">Envíos</TabsTrigger>
          <TabsTrigger value="slots">Franjas horarias</TabsTrigger>
          <TabsTrigger value="origin">Origen de reparto</TabsTrigger>
          <TabsTrigger value="search-area">Área de búsqueda</TabsTrigger>
        </TabsList>

        <TabsContent value="branding">
          <BrandingForm branding={branding} />
        </TabsContent>

        <TabsContent value="capacity">
          <CapacityForm
            defaultDailyCapacity={settings.defaultDailyCapacity}
            defaultSlotCapacity={settings.defaultSlotCapacity}
            maxSlotCapacity={settings.maxSlotCapacity}
            maxDailyCapacity={settings.maxDailyCapacity}
          />
        </TabsContent>

        <TabsContent value="delivery-days">
          <DeliveryDaysForm activeDeliveryDays={settings.activeDeliveryDays} />
        </TabsContent>

        <TabsContent value="products">
          <ProductsManager products={products} />
        </TabsContent>

        <TabsContent value="discounts">
          <VolumeDiscountsManager discounts={volumeDiscounts} categories={categories} />
        </TabsContent>

        <TabsContent value="messages">
          <MessageTemplatesManager templates={messageTemplates} />
        </TabsContent>

        <TabsContent value="payments">
          <SimpleListManager
            title="Formas de pago"
            description="Cómo paga el cliente (efectivo, transferencia, …)."
            addLabel="Nueva forma de pago"
            emptyLabel="No hay formas de pago. Cree la primera."
            namePlaceholder="Efectivo"
            noun="forma de pago"
            items={paymentMethods}
            createAction={createPaymentMethod}
            updateAction={updatePaymentMethod}
            toggleAction={setPaymentMethodActive}
          />
        </TabsContent>

        <TabsContent value="shipping">
          <SimpleListManager
            title="Formas de envío"
            description="En qué se envía el pedido (vehículos propios, PedidosYa, Uber Envíos, …)."
            addLabel="Nueva forma de envío"
            emptyLabel="No hay formas de envío. Cree la primera."
            namePlaceholder="Vehículo de Pablo"
            noun="forma de envío"
            items={shippingMethods}
            createAction={createShippingMethod}
            updateAction={updateShippingMethod}
            toggleAction={setShippingMethodActive}
          />
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
