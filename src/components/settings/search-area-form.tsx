"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AddressPicker } from "@/components/orders/address-picker";
import { updateSearchArea } from "@/server/actions/settings";

export function SearchAreaForm({
  searchLabel,
  searchCenterLat,
  searchCenterLng,
  searchRadiusKm,
}: {
  searchLabel: string;
  searchCenterLat: number;
  searchCenterLng: number;
  searchRadiusKm: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [label, setLabel] = useState(searchLabel);
  const [centerAddress, setCenterAddress] = useState(searchLabel);
  const [lat, setLat] = useState<number | null>(searchCenterLat);
  const [lng, setLng] = useState<number | null>(searchCenterLng);
  const [radius, setRadius] = useState<number>(searchRadiusKm);

  function save() {
    if (lat == null || lng == null) {
      toast.error("Elegí un centro en el mapa.");
      return;
    }
    startTransition(async () => {
      const res = await updateSearchArea({
        searchLabel: label,
        searchCenterLat: lat,
        searchCenterLng: lng,
        searchRadiusKm: radius,
      });
      if (res.ok) {
        toast.success("Área de búsqueda guardada");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Área de búsqueda de direcciones</CardTitle>
        <CardDescription>
          Las sugerencias de dirección al cargar un pedido se limitan a esta zona.
          Elegí el centro en el mapa y el radio de cobertura.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Nombre del área</Label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="San Miguel de Tucumán"
            />
          </div>
          <div className="space-y-2">
            <Label>Radio de cobertura (km)</Label>
            <Input
              type="number"
              min={1}
              max={200}
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Centro del área</Label>
          <AddressPicker
            address={centerAddress}
            onAddressChange={setCenterAddress}
            lat={lat}
            lng={lng}
            onCoordsChange={(la, lo) => {
              setLat(la);
              setLng(lo);
            }}
            searchArea={null}
          />
        </div>

        <Button onClick={save} disabled={pending}>
          {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Guardar área
        </Button>
      </CardContent>
    </Card>
  );
}
