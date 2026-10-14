/**
 * Direct-bus search over the BMTC network index.
 *
 * Deliberately direct routes only — no transfers. A transfer-capable planner is
 * a different class of problem (RAPTOR/Connection Scan over the full timetable),
 * and on a feed whose per-trip times are known to be unreliable it would produce
 * confident-looking itineraries built on bad data. A direct route either exists
 * or it does not, which the stop sequences answer correctly.
 */
import type { BusNetwork, DirectBus } from '@/types/transit';

const EARTH_RADIUS_M = 6_371_000;

export function haversineMetres(
  aLat: number, aLon: number, bLat: number, bLon: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLon / 2) ** 2 * Math.cos(toRad(aLat)) * Math.cos(toRad(bLat));
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

export interface NearbyStop {
  id: string;
  name: string;
  lat: number;
  lon: number;
  distance: number;
}

/** Bus stops near a point, nearest first. */
export function nearestStops(
  network: BusNetwork, lat: number, lon: number, limit = 5, maxMetres = 1200,
): NearbyStop[] {
  const out: NearbyStop[] = [];
  for (const [id, s] of Object.entries(network.stops)) {
    // Cheap bounding-box reject before the trig.
    if (Math.abs(s.lat - lat) > 0.02 || Math.abs(s.lon - lon) > 0.02) continue;
    const d = haversineMetres(lat, lon, s.lat, s.lon);
    if (d <= maxMetres) out.push({ id, name: s.name, lat: s.lat, lon: s.lon, distance: Math.round(d) });
  }
  return out.sort((a, b) => a.distance - b.distance).slice(0, limit);
}

/** Stops whose name matches a query, for picking a destination. */
export function searchStops(network: BusNetwork, query: string, limit = 8): NearbyStop[] {
  const needle = query.trim().toLowerCase();
  if (needle.length < 2) return [];
  const out: NearbyStop[] = [];
  for (const [id, s] of Object.entries(network.stops)) {
    const name = s.name.toLowerCase();
    if (!name.includes(needle)) continue;
    out.push({ id, name: s.name, lat: s.lat, lon: s.lon, distance: 0 });
    // Names repeat across directions; a generous cap still leaves room to rank.
    if (out.length > limit * 6) break;
  }
  // Prefer matches at the start of the name — "Indiranagar" over
  // "Opposite Indiranagar Club".
  return out
    .sort((a, b) => {
      const ai = a.name.toLowerCase().indexOf(needle);
      const bi = b.name.toLowerCase().indexOf(needle);
      return ai - bi || a.name.length - b.name.length;
    })
    .slice(0, limit);
}

/**
 * Direct buses between two sets of stops.
 *
 * Origin and destination are given as stop-id sets rather than single stops
 * because one place is usually served by several stops (each direction gets its
 * own id), and a rider does not care which of them the bus happens to use.
 */
export function findDirectBuses(
  network: BusNetwork, fromIds: Set<string>, toIds: Set<string>, limit = 12,
): DirectBus[] {
  const results: DirectBus[] = [];

  for (const [routeId, route] of Object.entries(network.routes)) {
    let boardIdx = -1;
    let boardId = '';
    // First origin stop on the path, then the first destination stop after it.
    for (let i = 0; i < route.stops.length; i++) {
      if (fromIds.has(route.stops[i])) { boardIdx = i; boardId = route.stops[i]; break; }
    }
    if (boardIdx < 0) continue;

    let alightIdx = -1;
    let alightId = '';
    for (let i = boardIdx + 1; i < route.stops.length; i++) {
      if (toIds.has(route.stops[i])) { alightIdx = i; alightId = route.stops[i]; break; }
    }
    if (alightIdx < 0) continue;

    results.push({
      routeId,
      name: route.name,
      long: route.long,
      boardStopId: boardId,
      alightStopId: alightId,
      stopCount: alightIdx - boardIdx,
      path: route.stops
        .slice(boardIdx, alightIdx + 1)
        .map((id) => network.stops[id]?.name ?? id),
    });
  }

  // Fewest stops first — the most direct ride wins.
  return results.sort((a, b) => a.stopCount - b.stopCount).slice(0, limit);
}

/** All stop ids sharing a name, so both directions of a stop are matched. */
export function stopIdsNamed(network: BusNetwork, name: string): Set<string> {
  const target = name.trim().toLowerCase();
  const ids = new Set<string>();
  for (const [id, s] of Object.entries(network.stops)) {
    if (s.name.trim().toLowerCase() === target) ids.add(id);
  }
  return ids;
}
