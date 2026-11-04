import type { Poi, Station } from '@/types/transit';
import { haversineKm } from './geo';

/**
 * Turning BMRCL's entrance list into something a rider can act on.
 *
 * The feed names entrances "Entrance A", "Entrance B" — or, for 38 of them,
 * just "Entrance" — with a coordinate each. A letter on its own tells nobody
 * which way to go. What does: which side of the station the exit is on, and
 * a landmark beside it, both derived here from data already on the page.
 */

const COMPASS = ['North', 'North-east', 'East', 'South-east', 'South', 'South-west', 'West', 'North-west'];

/** Initial bearing from one point to another, degrees clockwise from north. */
export function bearingDeg(fromLat: number, fromLon: number, toLat: number, toLon: number): number {
  const rad = Math.PI / 180;
  const y = Math.sin((toLon - fromLon) * rad) * Math.cos(toLat * rad);
  const x = Math.cos(fromLat * rad) * Math.sin(toLat * rad)
    - Math.sin(fromLat * rad) * Math.cos(toLat * rad) * Math.cos((toLon - fromLon) * rad);
  return (Math.atan2(y, x) / rad + 360) % 360;
}

/** "North-east" and friends, eight points. */
export function compassPoint(deg: number): string {
  return COMPASS[Math.round(deg / 45) % 8];
}

export interface ExitInfo {
  id: string;
  /** "A", or null for an unlettered entrance. */
  letter: string | null;
  /** "Exit A", or "North-east exit" when there is no letter. */
  label: string;
  side: string;
  /** Nearest named place within LANDMARK_RADIUS_M, if any. */
  landmark: { name: string; metres: number } | null;
  lat: number;
  lon: number;
  /** Metres east and north of the station centre, for the diagram. */
  east: number;
  north: number;
  toPlatformSec: number;
}

/** A landmark further than this from the exit would mislead more than help. */
export const LANDMARK_RADIUS_M = 150;

export function describeExits(station: Station, pois: Poi[]): ExitInfo[] {
  const cosLat = Math.cos((station.lat * Math.PI) / 180);
  return (station.entrances ?? []).map((e) => {
    const letter = e.name.match(/\b([A-Z])$/)?.[1] ?? null;
    const side = compassPoint(bearingDeg(station.lat, station.lon, e.lat, e.lon));
    let landmark: ExitInfo['landmark'] = null;
    for (const p of pois) {
      const metres = Math.round(haversineKm(e.lat, e.lon, p.lat, p.lon) * 1000);
      if (metres <= LANDMARK_RADIUS_M && (!landmark || metres < landmark.metres)) {
        landmark = { name: p.name, metres };
      }
    }
    return {
      id: e.id,
      letter,
      label: letter ? `Exit ${letter}` : `${side} exit`,
      side,
      landmark,
      lat: e.lat,
      lon: e.lon,
      east: (e.lon - station.lon) * cosLat * 111_320,
      north: (e.lat - station.lat) * 110_540,
      toPlatformSec: e.toPlatformSec ?? 90,
    };
  });
}

/** The exit nearest a point: the one to walk to, or to be dropped at. */
export function nearestExit(exits: ExitInfo[], lat: number, lon: number) {
  let best: { exit: ExitInfo; km: number } | null = null;
  for (const exit of exits) {
    const km = haversineKm(lat, lon, exit.lat, exit.lon);
    if (!best || km < best.km) best = { exit, km };
  }
  return best;
}
