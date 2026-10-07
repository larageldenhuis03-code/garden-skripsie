import type { Band } from "./spec.ts";
import type { PoliteClient } from "./http.ts";

/**
 * 7_Location: straight-line (haversine) distance from the user's area to
 * each branch, banded with the workbook's limits. Road distance is future
 * work (the workbook says so).
 */

export type LatLon = { lat: number; lon: number };

/** d = 2R asin( sqrt( sin²(Δφ/2) + cos φ1 cos φ2 sin²(Δλ/2) ) ) */
export function haversineKm(a: LatLon, b: LatLon, earthRadiusKm: number): number {
  const rad = (degrees: number) => (degrees * Math.PI) / 180;
  const dPhi = rad(b.lat - a.lat);
  const dLambda = rad(b.lon - a.lon);
  const h =
    Math.sin(dPhi / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLambda / 2) ** 2;
  return 2 * earthRadiusKm * Math.asin(Math.sqrt(h));
}

/** The band a distance falls in: from <= d < to (the last band is open). */
export function bandFor(km: number, bands: Band[]): Band | null {
  return bands.find((band) => km >= band.fromKm && (band.toKm === null || km < band.toKm)) ?? null;
}

const NOMINATIM = "https://nominatim.openstreetmap.org/search";

/**
 * Live geocoding with OpenStreetMap Nominatim, cached per query. Follows the
 * usage policy through the polite client: an identifying User-Agent and at
 * most one request per second.
 */
export async function geocode(client: PoliteClient, query: string): Promise<LatLon | null> {
  const url = `${NOMINATIM}?format=jsonv2&limit=1&countrycodes=za&q=${encodeURIComponent(query)}`;
  const result = await client.get<{ lat: string; lon: string }[]>(url, `geocode|${query.toLowerCase()}`);
  if (!result.ok || !Array.isArray(result.data) || result.data.length === 0) return null;
  return { lat: Number(result.data[0].lat), lon: Number(result.data[0].lon) };
}

/** A branch address, falling back to its town when the street is not found. */
export async function geocodeBranch(
  client: PoliteClient,
  address: string,
  town: string,
): Promise<{ point: LatLon; approximate: boolean } | null> {
  const street = address.replace(/\(.*?\)/g, "").replace(/\.$/, "").trim();
  const exact = await geocode(client, `${street}, ${town}, South Africa`);
  if (exact) return { point: exact, approximate: false };
  const townOnly = await geocode(client, `${town}, Western Cape, South Africa`);
  return townOnly ? { point: townOnly, approximate: true } : null;
}
