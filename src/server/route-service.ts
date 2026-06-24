import "server-only";
import dns from "node:dns";
import { solveOpenRoute, pathDistance, type LatLng } from "@/lib/route";

// Prefer IPv4 to avoid ETIMEDOUT on environments with broken IPv6 egress.
dns.setDefaultResultOrder?.("ipv4first");

export interface RouteStop extends LatLng {
  id: string;
  customerName: string;
  customerAddress: string;
  customerPhone: string;
  totalBowls: number;
  slotLabel: string;
  status: string;
}

export interface OptimizedRoute {
  ordered: RouteStop[];
  /** Polyline as [lat, lng] pairs for Leaflet. */
  geometry: [number, number][];
  distanceMeters: number;
  durationSeconds: number;
  engine: "geoapify" | "fallback";
}

const FALLBACK_SPEED_MPS = 6.94; // ~25 km/h urban estimate

/**
 * Optimal open route starting at `origin` (kitchen), ending at the last
 * delivery. The visiting order is solved locally (nearest-neighbour + 2-opt);
 * when GEOAPIFY_API_KEY is set we fetch real road geometry + distance/time for
 * that order, otherwise we draw straight lines with an estimated distance.
 */
export async function optimizeRoute(
  origin: LatLng,
  stops: RouteStop[],
): Promise<OptimizedRoute> {
  if (stops.length === 0) {
    return {
      ordered: [],
      geometry: [[origin.lat, origin.lng]],
      distanceMeters: 0,
      durationSeconds: 0,
      engine: "fallback",
    };
  }

  const ordered = solveOpenRoute(origin, stops);
  const key = process.env.GEOAPIFY_API_KEY;

  if (key) {
    try {
      return await geoapifyRoute(origin, ordered, key);
    } catch {
      /* fall through to offline geometry */
    }
  }

  const pts = [origin, ...ordered];
  const distanceMeters = pathDistance(pts);
  return {
    ordered,
    geometry: pts.map((p) => [p.lat, p.lng] as [number, number]),
    distanceMeters,
    durationSeconds: distanceMeters / FALLBACK_SPEED_MPS,
    engine: "fallback",
  };
}

async function geoapifyRoute(
  origin: LatLng,
  ordered: RouteStop[],
  key: string,
): Promise<OptimizedRoute> {
  const waypoints = [origin, ...ordered].map((p) => `${p.lat},${p.lng}`).join("|");
  const params = new URLSearchParams({ waypoints, mode: "drive", apiKey: key, lang: "es" });
  const res = await fetch(`https://api.geoapify.com/v1/routing?${params}`, {
    signal: AbortSignal.timeout(8000),
  });
  const data = (await res.json()) as {
    features?: {
      geometry: { type: string; coordinates: number[][] | number[][][] };
      properties: { distance: number; time: number };
    }[];
  };
  const f = data.features?.[0];
  if (!f?.geometry) throw new Error("Geoapify: no route");

  const raw =
    f.geometry.type === "MultiLineString"
      ? (f.geometry.coordinates as number[][][]).flat()
      : (f.geometry.coordinates as number[][]);
  const geometry = raw.map(([lng, lat]) => [lat, lng] as [number, number]);

  return {
    ordered,
    geometry,
    distanceMeters: f.properties.distance,
    durationSeconds: f.properties.time,
    engine: "geoapify",
  };
}
