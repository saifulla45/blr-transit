import type { Station } from '@/types/transit';

export interface Located<T> { item: T; distanceKm: number }

const EARTH_RADIUS_KM = 6371;

/** Great-circle distance. Straight-line, not walking distance. */
export function haversineKm(
  aLat: number, aLon: number, bLat: number, bLon: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/**
 * Nearest N stations. A linear scan is deliberate: with 83 stations a spatial
 * index would be slower to build than the scan it replaces.
 */
export function nearestStations(
  lat: number, lon: number, stations: Station[], n = 3,
): Array<Located<Station>> {
  return stations
    .map((item) => ({ item, distanceKm: haversineKm(lat, lon, item.lat, item.lon) }))
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, n);
}

/**
 * Furthest a station can be and still be worth showing as "nearest".
 *
 * Beyond this the answer is not useful — someone opening this in Delhi was
 * being told the nearest station was 1,700 km and a 280,000 minute walk, which
 * is technically true and completely useless.
 */
export const SERVICE_RADIUS_KM = 60;

export function formatDistance(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

/** Rough walking time at ~4.5 km/h, padded for the fact this is straight-line. */
export function walkingMinutes(km: number): number {
  return Math.max(1, Math.round((km / 4.5) * 60 * 1.25));
}
