"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import type * as LType from "leaflet";
import { Input } from "@/components/ui/input";
import { Loader2, MapPin, X } from "lucide-react";
import { cn } from "@/lib/utils";

// Buenos Aires as the default map center / search bias.
const AR_CENTER: [number, number] = [-34.6037, -58.3816];

interface PhotonProps {
  name?: string;
  housenumber?: string;
  street?: string;
  postcode?: string;
  city?: string;
  district?: string;
  county?: string;
  state?: string;
  country?: string;
  countrycode?: string;
}
interface PhotonFeature {
  geometry: { coordinates: [number, number] }; // [lon, lat]
  properties: PhotonProps;
}

function labelFromProps(p: PhotonProps): string {
  const streetPart = [p.street ?? p.name, p.housenumber].filter(Boolean).join(" ");
  const locality = p.city ?? p.district ?? p.county;
  return [streetPart || p.name, locality, p.state].filter(Boolean).join(", ");
}

interface Props {
  address: string;
  onAddressChange: (v: string) => void;
  lat: number | null;
  lng: number | null;
  onCoordsChange: (lat: number | null, lng: number | null) => void;
  error?: string;
}

export function AddressPicker({
  address,
  onAddressChange,
  lat,
  lng,
  onCoordsChange,
  error,
}: Props) {
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LType.Map | null>(null);
  const markerRef = useRef<LType.Marker | null>(null);
  const leafletRef = useRef<typeof LType | null>(null);

  const [suggestions, setSuggestions] = useState<PhotonFeature[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const abortRef = useRef<AbortController | null>(null);

  // ── Initialise the Leaflet map once (client-only) ──────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !mapEl.current || mapRef.current) return;
      leafletRef.current = L;

      const icon = L.icon({
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41],
      });

      const start: [number, number] = lat != null && lng != null ? [lat, lng] : AR_CENTER;
      const map = L.map(mapEl.current).setView(start, lat != null ? 16 : 11);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap",
        maxZoom: 19,
      }).addTo(map);

      const marker = L.marker(start, { draggable: true, icon }).addTo(map);
      if (lat == null) marker.setOpacity(0); // hidden until a location is chosen

      marker.on("dragend", () => {
        const { lat: la, lng: lo } = marker.getLatLng();
        onCoordsChange(la, lo);
        reverseGeocode(la, lo);
      });
      map.on("click", (e: LType.LeafletMouseEvent) => {
        marker.setLatLng(e.latlng).setOpacity(1);
        onCoordsChange(e.latlng.lat, e.latlng.lng);
        reverseGeocode(e.latlng.lat, e.latlng.lng);
      });

      mapRef.current = map;
      markerRef.current = marker;
      // Leaflet needs a size recalc after mount inside flex/grid layouts.
      setTimeout(() => map.invalidateSize(), 0);
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function movePin(la: number, lo: number, zoom = 16) {
    onCoordsChange(la, lo);
    const map = mapRef.current;
    const marker = markerRef.current;
    if (map && marker) {
      marker.setLatLng([la, lo]).setOpacity(1);
      map.setView([la, lo], zoom);
    }
  }

  // ── Photon autocomplete (Argentina-only) ───────────────────────
  function search(q: string) {
    clearTimeout(debounceRef.current);
    if (q.trim().length < 4) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setLoading(true);
      try {
        // Photon's public API only supports lang default/de/en/fr — omitting
        // `lang` returns local (Spanish) names for Argentine places.
        const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(
          q,
        )}&limit=8&lat=${AR_CENTER[0]}&lon=${AR_CENTER[1]}`;
        const res = await fetch(url, { signal: ctrl.signal });
        const data = (await res.json()) as { features: PhotonFeature[] };
        const arOnly = (data.features ?? []).filter(
          (f) => f.properties.countrycode === "AR",
        );
        setSuggestions(arOnly);
        setOpen(arOnly.length > 0);
      } catch {
        /* aborted or network error — ignore */
      } finally {
        setLoading(false);
      }
    }, 350);
  }

  async function reverseGeocode(la: number, lo: number) {
    try {
      const res = await fetch(`https://photon.komoot.io/reverse?lat=${la}&lon=${lo}`);
      const data = (await res.json()) as { features: PhotonFeature[] };
      const f = data.features?.[0];
      if (f) onAddressChange(labelFromProps(f.properties));
    } catch {
      /* ignore */
    }
  }

  function pick(f: PhotonFeature) {
    const [lo, la] = f.geometry.coordinates;
    onAddressChange(labelFromProps(f.properties));
    movePin(la, lo);
    setOpen(false);
    setSuggestions([]);
  }

  function clearPin() {
    onCoordsChange(null, null);
    const marker = markerRef.current;
    marker?.setOpacity(0);
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <div className="relative">
          <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={address}
            onChange={(e) => {
              onAddressChange(e.target.value);
              search(e.target.value);
            }}
            onFocus={() => suggestions.length && setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            placeholder="Buscar dirección (calle y altura, localidad)…"
            className="pl-9"
            autoComplete="off"
          />
          {loading && (
            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          )}
        </div>
        {open && suggestions.length > 0 && (
          <ul className="absolute z-[1000] mt-1 max-h-64 w-full overflow-auto rounded-md border bg-popover p-1 shadow-md">
            {suggestions.map((f, i) => (
              <li key={i}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(f)}
                  className="flex w-full items-start gap-2 rounded-sm px-2 py-2 text-left text-sm hover:bg-accent"
                >
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <span>{labelFromProps(f.properties)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && <p className="text-sm font-medium text-destructive">{error}</p>}

      <div className="relative overflow-hidden rounded-lg border">
        <div ref={mapEl} className="h-[260px] w-full" />
        {lat != null && lng != null && (
          <button
            type="button"
            onClick={clearPin}
            className="absolute right-2 top-2 z-[1000] inline-flex items-center gap-1 rounded-md bg-background/90 px-2 py-1 text-xs font-medium shadow hover:bg-background"
          >
            <X className="h-3 w-3" /> Quitar pin
          </button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        {lat != null && lng != null
          ? `Pin: ${lat.toFixed(5)}, ${lng.toFixed(5)} · arrastralo o tocá el mapa para ajustar.`
          : "Buscá una dirección o tocá el mapa para colocar el pin (opcional)."}
      </p>
    </div>
  );
}
