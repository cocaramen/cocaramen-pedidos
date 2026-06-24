"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import type * as LType from "leaflet";

export interface MapStop {
  lat: number;
  lng: number;
  label: string; // popup text
}

interface Props {
  origin: { lat: number; lng: number; address: string };
  stops: MapStop[]; // already in visiting order
  geometry: [number, number][]; // [lat, lng]
}

export function RouteMap({ origin, stops, geometry }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LType.Map | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !el.current || mapRef.current) return;

      const map = L.map(el.current);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap",
        maxZoom: 19,
      }).addTo(map);
      mapRef.current = map;

      // Origin marker (kitchen)
      const originIcon = L.divIcon({
        className: "",
        html: `<div style="background:#0f172a;color:#fff;border:2px solid #fff;border-radius:9999px;width:30px;height:30px;display:flex;align-items:center;justify-content:center;font-size:15px;box-shadow:0 1px 4px rgba(0,0,0,.4)">🍜</div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      });
      L.marker([origin.lat, origin.lng], { icon: originIcon })
        .addTo(map)
        .bindPopup(`<b>Origen</b><br/>${origin.address}`);

      // Numbered stop markers
      stops.forEach((s, i) => {
        const icon = L.divIcon({
          className: "",
          html: `<div style="background:#ea580c;color:#fff;border:2px solid #fff;border-radius:9999px;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;box-shadow:0 1px 4px rgba(0,0,0,.4)">${i + 1}</div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });
        L.marker([s.lat, s.lng], { icon }).addTo(map).bindPopup(s.label);
      });

      // Route polyline
      if (geometry.length > 1) {
        L.polyline(geometry, { color: "#ea580c", weight: 4, opacity: 0.8 }).addTo(map);
      }

      // Fit to all points
      const all: [number, number][] = [
        [origin.lat, origin.lng],
        ...stops.map((s) => [s.lat, s.lng] as [number, number]),
      ];
      map.fitBounds(L.latLngBounds(all).pad(0.15));
      setTimeout(() => map.invalidateSize(), 0);
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origin.lat, origin.lng, JSON.stringify(stops), JSON.stringify(geometry)]);

  return <div ref={el} className="h-[420px] w-full rounded-lg border" />;
}
