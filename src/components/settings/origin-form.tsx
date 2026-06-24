"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { AddressPicker } from "@/components/orders/address-picker";
import { updateDeliveryOrigin } from "@/server/actions/settings";

export function OriginForm({
  originAddress,
  originLat,
  originLng,
}: {
  originAddress: string | null;
  originLat: number | null;
  originLng: number | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [address, setAddress] = useState(originAddress ?? "");
  const [lat, setLat] = useState<number | null>(originLat);
  const [lng, setLng] = useState<number | null>(originLng);

  function save() {
    startTransition(async () => {
      const res = await updateDeliveryOrigin({
        originAddress: address,
        originLat: lat,
        originLng: lng,
      });
      if (res.ok) {
        toast.success("Origen de reparto guardado");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Origen de reparto</CardTitle>
        <CardDescription>
          Punto de partida del repartidor (la cocina/local). Las rutas se calculan
          desde acá. Buscá la dirección o ajustá el pin en el mapa.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Dirección de la cocina</Label>
          <AddressPicker
            address={address}
            onAddressChange={setAddress}
            lat={lat}
            lng={lng}
            onCoordsChange={(la, lo) => {
              setLat(la);
              setLng(lo);
            }}
          />
        </div>
        {lat == null && (
          <p className="text-sm text-warning-foreground">
            Sin pin no se puede calcular la ruta. Elegí una sugerencia o tocá el mapa.
          </p>
        )}
        <Button onClick={save} disabled={pending}>
          {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Guardar origen
        </Button>
      </CardContent>
    </Card>
  );
}
