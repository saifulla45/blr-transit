/**
 * Server-side data loaders. These run at build time only.
 *
 * Reading the JSON here and inlining it into prerendered pages avoids fetching
 * from /data at runtime, which in turn avoids the stale-CDN-cache problem:
 * files under public/ are not content-hashed by Next, so a refreshed timetable
 * fetched at runtime could keep serving the old copy for days. A data refresh
 * now goes: pipeline -> commit -> redeploy -> new HTML, with no cache to bust.
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type {
  BusesByStation, BusRoute, CalendarOverrides, FareMatrix, FareWindows, JourneyMatrix,
  NetworkStatus, Poi, PoisByStation, StationTimetable, StationsIndex, TravelPass,
} from '@/types/transit';

const DATA = join(process.cwd(), 'public', 'data');

async function readJson<T>(...parts: string[]): Promise<T> {
  return JSON.parse(await readFile(join(DATA, ...parts), 'utf8')) as T;
}

export const getStationsIndex = () => readJson<StationsIndex>('stations.json');
export const getOverrides = () => readJson<CalendarOverrides>('calendar-overrides.json');
export const getNetwork = () => readJson<NetworkStatus>('network.json');
export const getTimetable = (id: string) =>
  readJson<StationTimetable>('stations', `${id}.json`);

/** BMTC routes near one station. Empty when the bus build has not run. */
export async function getBusesFor(stationId: string): Promise<BusRoute[]> {
  try {
    const all = await readJson<BusesByStation>('buses.json');
    return all[stationId] ?? [];
  } catch {
    // buses.json is optional; the transit data must build without it.
    return [];
  }
}

/** Nearby places for one station. Empty when the POI build has not run yet. */
export async function getPoisFor(stationId: string): Promise<Poi[]> {
  try {
    const all = await readJson<PoisByStation>('pois.json');
    return all[stationId] ?? [];
  } catch {
    // pois.json is optional: the transit data must still build without it.
    return [];
  }
}

/** Journey time, distance and interchanges from one origin. */
export async function getJourneysFrom(
  originId: string,
): Promise<Record<string, [number, number, number, string[]]>> {
  try {
    const all = await readJson<JourneyMatrix>('journeys.json');
    return all[originId] ?? {};
  } catch {
    return {};
  }
}

/**
 * Fares from one origin only. The full matrix is ~68 KB; inlining just the
 * origin's row keeps each station page around 1 KB of fare data.
 */
export async function getFaresFrom(
  originId: string,
): Promise<Record<string, [number, number, number]>> {
  const all = await readJson<FareMatrix>('fares.json');
  return all[originId] ?? {};
}

/** Peak windows per service pattern. */
export const getFareWindows = () => readJson<FareWindows>('fare-windows.json');

/** Unlimited-travel passes, for the break-even hint. */
export const getPasses = async (): Promise<TravelPass[]> => {
  try { return await readJson<TravelPass[]>('passes.json'); } catch { return []; }
};
