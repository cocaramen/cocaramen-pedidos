"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import type * as LType from "leaflet";
import { Input } from "@/components/ui/input";
import { Loader2, MapPin, X } from "lucide-react";
import {
  searchAddresses,
  reverseGeocode as reverseGeocodeAction,
  type GeoSuggestion,
} from "@/server/actions/geocode";

// Argentina center — fallback map view when no search area is configured.
const AR_CENTER: [number, number] = [-34.6037, -58.3816];

export interface SearchArea {
  lat: number;
  lng: number;
  radiusKm: number;
  label?: string;
}

interface Props {
  address: string;
  onAddressChange: (v: string) => void;
  lat: number | null;
  lng: number | null;
  onCoordsChange: (lat: number | null, lng: number | null) => void;
  error?: string;
  /** Restrict suggestions to within radiusKm of this center. */
  searchArea?: SearchArea | null;
}

export function AddressPicker({
  address,
  onAddressChange,
  lat,
  lng,
  onCoordsChange,
  error,
  searchArea,
}: Props) {
  const center: [number, number] = searchArea ? [searchArea.lat, searchArea.lng] : AR_CENTER;
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LType.Map | null>(null);
  const markerRef = useRef<LType.Marker | null>(null);

  const [suggestions, setSuggestions] = useState<GeoSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const reqRef = useRef(0);

  // ── Initialise the Leaflet map once (client-only) ──────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !mapEl.current || mapRef.current) return;

      const icon = L.icon({
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41],
      });

      const start: [number, number] = lat != null && lng != null ? [lat, lng] : center;
      const map = L.map(mapEl.current).setView(start, lat != null ? 16 : searchArea ? 13 : 11);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap",
        maxZoom: 19,
      }).addTo(map);

      const marker = L.marker(start, { draggable: true, icon }).addTo(map);
      if (lat == null) marker.setOpacity(0);

      marker.on("dragend", () => {
        const { lat: la, lng: lo } = marker.getLatLng();
        onCoordsChange(la, lo);
        void fillFromReverse(la, lo);
      });
      map.on("click", (e: LType.LeafletMouseEvent) => {
        marker.setLatLng(e.latlng).setOpacity(1);
        onCoordsChange(e.latlng.lat, e.latlng.lng);
        void fillFromReverse(e.latlng.lat, e.latlng.lng);
      });

      mapRef.current = map;
      markerRef.current = marker;
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

  // ── Autocomplete (server-proxied: Geoapify w/ Photon fallback) ──
  function search(q: string) {
    clearTimeout(debounceRef.current);
    if (q.trim().length < 3) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      const reqId = ++reqRef.current;
      setLoading(true);
      try {
        const results = await searchAddresses(q, searchArea ?? null);
        if (reqId !== reqRef.current) return; // stale response
        setSuggestions(results);
        setOpen(results.length > 0);
      } catch {
        /* ignore */
      } finally {
        if (reqId === reqRef.current) setLoading(false);
      }
    }, 350);
  }

  async function fillFromReverse(la: number, lo: number) {
    const label = await reverseGeocodeAction(la, lo);
    if (label) onAddressChange(label);
  }

  function pick(s: GeoSuggestion) {
    onAddressChange(s.label);
    movePin(s.lat, s.lng);
    setOpen(false);
    setSuggestions([]);
  }

  function clearPin() {
    onCoordsChange(null, null);
    markerRef.current?.setOpacity(0);
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
            placeholder={
              searchArea?.label
                ? `Buscar dirección en ${searchArea.label}…`
                : "Buscar dirección (calle y altura, localidad)…"
            }
            className="pl-9"
            autoComplete="off"
          />
          {loading && (
            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          )}
        </div>
        {open && suggestions.length > 0 && (
          <ul className="absolute z-[1000] mt-1 max-h-64 w-full overflow-auto rounded-md border bg-popover p-1 shadow-md">
            {suggestions.map((s, i) => (
              <li key={i}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(s)}
                  className="flex w-full items-start gap-2 rounded-sm px-2 py-2 text-left text-sm hover:bg-accent"
                >
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <span>{s.label}</span>
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
