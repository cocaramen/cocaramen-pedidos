/**
 * Pure routing helpers (no DB / no network) so they are unit-testable and
 * usable as the offline fallback when the OSRM service is unavailable.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_M = 6_371_000;

/** Great-circle distance between two points, in meters. */
export function haversineMeters(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/** Total length of a path that visits the points in order. */
export function pathDistance(points: LatLng[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += haversineMeters(points[i - 1], points[i]);
  return total;
}

/**
 * Order `stops` into a short open route that starts at `origin` (the origin is
 * NOT returned). Nearest-neighbour construction followed by a 2-opt refinement.
 * Generic over any item carrying lat/lng.
 */
export function solveOpenRoute<T extends LatLng>(origin: LatLng, stops: T[]): T[] {
  if (stops.length <= 1) return [...stops];

  // Nearest neighbour
  const remaining = [...stops];
  const ordered: T[] = [];
  let current: LatLng = origin;
  while (remaining.length) {
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = haversineMeters(current, remaining[i]);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
    current = remaining[best];
    ordered.push(remaining.splice(best, 1)[0]);
  }

  // 2-opt (open path, fixed start = origin)
  const dist = (a: LatLng, b: LatLng) => haversineMeters(a, b);
  const routeLen = (arr: T[]) => pathDistance([origin, ...arr]);
  let improved = true;
  let best = ordered;
  let guard = 0;
  while (improved && guard++ < 50) {
    improved = false;
    for (let i = 0; i < best.length - 1; i++) {
      for (let k = i + 1; k < best.length; k++) {
        const candidate = best
          .slice(0, i)
          .concat(best.slice(i, k + 1).reverse(), best.slice(k + 1));
        if (routeLen(candidate) + 1e-6 < routeLen(best)) {
          best = candidate;
          improved = true;
        }
      }
    }
  }
  // silence unused in some builds
  void dist;
  return best;
}

/** Google Maps directions URL: origin → waypoints… → destination (one-way). */
export function googleMapsDirUrl(origin: LatLng, orderedStops: LatLng[]): string {
  if (orderedStops.length === 0) {
    return `https://www.google.com/maps/dir/?api=1&destination=${origin.lat},${origin.lng}`;
  }
  const dest = orderedStops[orderedStops.length - 1];
  const mids = orderedStops.slice(0, -1);
  const params = new URLSearchParams({
    api: "1",
    origin: `${origin.lat},${origin.lng}`,
    destination: `${dest.lat},${dest.lng}`,
    travelmode: "driving",
  });
  if (mids.length) {
    params.set("waypoints", mids.map((p) => `${p.lat},${p.lng}`).join("|"));
  }
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

/**
 * Google Maps directions URL built from ADDRESS TEXT (not coordinates), so the
 * driver sees the exact addresses the operator chose — Google geocodes them with
 * its own data (avoids OSM-vs-Google house-number mismatches).
 */
export function googleMapsDirUrlFromAddresses(origin: string, stops: string[]): string {
  if (stops.length === 0) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(origin)}`;
  }
  const dest = stops[stops.length - 1];
  const mids = stops.slice(0, -1);
  const params = new URLSearchParams({
    api: "1",
    origin,
    destination: dest,
    travelmode: "driving",
  });
  if (mids.length) params.set("waypoints", mids.join("|"));
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export function formatDistance(meters: number): string {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`;
}

export function formatDuration(seconds: number): string {
  const min = Math.round(seconds / 60);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  return `${h} h ${min % 60} min`;
}
