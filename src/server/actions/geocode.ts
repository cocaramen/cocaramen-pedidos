"use server";

import { requireUser } from "@/lib/auth/session";
import { haversineMeters } from "@/lib/route";

export interface GeoSuggestion {
  label: string;
  lat: number;
  lng: number;
}

export interface SearchAreaInput {
  lat: number;
  lng: number;
  radiusKm: number;
}

const GEOAPIFY = "https://api.geoapify.com/v1";

/**
 * Address autocomplete proxied server-side (keeps the API key secret).
 * Uses Geoapify when GEOAPIFY_API_KEY is set; otherwise falls back to the
 * public Photon service. Restricted to Argentina, optionally to a circle.
 */
export async function searchAddresses(
  query: string,
  area?: SearchAreaInput | null,
): Promise<GeoSuggestion[]> {
  await requireUser();
  const q = query.trim();
  if (q.length < 3) return [];

  const key = process.env.GEOAPIFY_API_KEY;
  try {
    return key ? await geoapifyAutocomplete(q, area, key) : await photonAutocomplete(q, area);
  } catch {
    return [];
  }
}

export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  await requireUser();
  const key = process.env.GEOAPIFY_API_KEY;
  try {
    return key ? await geoapifyReverse(lat, lng, key) : await photonReverse(lat, lng);
  } catch {
    return null;
  }
}

// ── Geoapify ───────────────────────────────────────────────────
async function geoapifyAutocomplete(
  q: string,
  area: SearchAreaInput | null | undefined,
  key: string,
): Promise<GeoSuggestion[]> {
  const params = new URLSearchParams({
    text: q,
    lang: "es",
    limit: "8",
    format: "json",
    apiKey: key,
  });
  if (area) {
    params.set("filter", `circle:${area.lng},${area.lat},${Math.round(area.radiusKm * 1000)}`);
    params.set("bias", `proximity:${area.lng},${area.lat}`);
  } else {
    params.set("filter", "countrycode:ar");
  }
  const res = await fetch(`${GEOAPIFY}/geocode/autocomplete?${params}`, {
    signal: AbortSignal.timeout(7000),
  });
  const data = (await res.json()) as {
    results?: { lat: number; lon: number; address_line1?: string; city?: string; formatted?: string }[];
  };
  return (data.results ?? [])
    .filter((r) => typeof r.lat === "number" && typeof r.lon === "number")
    .map((r) => ({
      label: [r.address_line1, r.city].filter(Boolean).join(", ") || r.formatted || "",
      lat: r.lat,
      lng: r.lon,
    }))
    .filter((s) => s.label);
}

async function geoapifyReverse(lat: number, lng: number, key: string): Promise<string | null> {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lng),
    lang: "es",
    format: "json",
    apiKey: key,
  });
  const res = await fetch(`${GEOAPIFY}/geocode/reverse?${params}`, {
    signal: AbortSignal.timeout(7000),
  });
  const data = (await res.json()) as {
    results?: { address_line1?: string; city?: string; formatted?: string }[];
  };
  const r = data.results?.[0];
  if (!r) return null;
  return [r.address_line1, r.city].filter(Boolean).join(", ") || r.formatted || null;
}

// ── Photon fallback ────────────────────────────────────────────
interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: {
    name?: string;
    housenumber?: string;
    street?: string;
    city?: string;
    district?: string;
    county?: string;
    state?: string;
    countrycode?: string;
  };
}

function photonLabel(p: PhotonFeature["properties"]): string {
  const streetPart = [p.street ?? p.name, p.housenumber].filter(Boolean).join(" ");
  const locality = p.city ?? p.district ?? p.county;
  return [streetPart || p.name, locality, p.state].filter(Boolean).join(", ");
}

async function photonAutocomplete(
  q: string,
  area: SearchAreaInput | null | undefined,
): Promise<GeoSuggestion[]> {
  const lat = area?.lat ?? -34.6037;
  const lng = area?.lng ?? -58.3816;
  const res = await fetch(
    `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=12&lat=${lat}&lon=${lng}`,
    { signal: AbortSignal.timeout(7000) },
  );
  const data = (await res.json()) as { features?: PhotonFeature[] };
  return (data.features ?? [])
    .filter((f) => {
      if (f.properties.countrycode !== "AR") return false;
      if (!area) return true;
      const [lo, la] = f.geometry.coordinates;
      return haversineMeters({ lat: area.lat, lng: area.lng }, { lat: la, lng: lo }) <= area.radiusKm * 1000;
    })
    .map((f) => {
      const [lo, la] = f.geometry.coordinates;
      return { label: photonLabel(f.properties), lat: la, lng: lo };
    })
    .filter((s) => s.label);
}

async function photonReverse(lat: number, lng: number): Promise<string | null> {
  const res = await fetch(`https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}`, {
    signal: AbortSignal.timeout(7000),
  });
  const data = (await res.json()) as { features?: PhotonFeature[] };
  const f = data.features?.[0];
  return f ? photonLabel(f.properties) : null;
}
