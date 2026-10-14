/**
 * BMTC bus routes serving each metro station.
 *
 * The BMTC feed is ~44 MB zipped and 204 MB unpacked (stop_times.txt alone is
 * 78 MB), so unlike the metro feed it is never loaded whole. It is written to a
 * temp file and streamed line by line, keeping only the rows for bus stops that
 * are actually within walking distance of a metro station — about 730 of 9,960.
 *
 * Data quality: this feed is scraped from the Namma BMTC app and its timetables
 * are known to be inaccurate. We therefore surface *which routes you can catch
 * and roughly how often*, and label the times as approximate, rather than
 * presenting a precise "next bus" a rider would plan around.
 */
import AdmZip from 'adm-zip';
import { createReadStream, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseCsv, toMinutes, type Row } from './gtfs';
import type { BusNetwork, BusRoute, BusesByStation, Station } from '../types/transit';

const FEED_URL = 'https://raw.githubusercontent.com/Vonter/bmtc-gtfs/main/gtfs/bmtc.zip';
/** A bus stop further than this is not a realistic interchange on foot. */
const RADIUS_M = 500;
/** Routes listed per metro station, ranked by how many trips they run. */
const MAX_ROUTES = 12;

export interface BusBuild {
  byStation: BusesByStation;
  /** Whole-network index powering "which bus goes from here to there". */
  network: BusNetwork;
}

export async function fetchBuses(stations: Station[]): Promise<BusBuild> {
  const res = await fetch(FEED_URL);
  if (!res.ok) throw new Error(`BMTC feed download failed: ${res.status}`);
  const zip = new AdmZip(Buffer.from(await res.arrayBuffer()));

  const read = (name: string): Row[] => {
    const entry = zip.getEntry(name);
    if (!entry) throw new Error(`BMTC feed is missing ${name}`);
    return parseCsv(entry.getData().toString('utf8'));
  };

  const busStops = read('stops.txt');
  const trips = read('trips.txt');
  const routes = read('routes.txt');

  // --- Which bus stops are within walking distance of which metro station ----
  const stopToStations = new Map<string, Array<{ stationId: string; distance: number }>>();
  const stopName = new Map<string, string>();
  for (const s of busStops) {
    const lat = Number(s.stop_lat);
    const lon = Number(s.stop_lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    for (const m of stations) {
      // Cheap bounding-box reject before the trig; ~0.006 deg comfortably
      // exceeds the radius at this latitude.
      if (Math.abs(lat - m.lat) > 0.006 || Math.abs(lon - m.lon) > 0.006) continue;
      const d = haversineMetres(m.lat, m.lon, lat, lon);
      if (d > RADIUS_M) continue;
      const list = stopToStations.get(s.stop_id) ?? [];
      list.push({ stationId: m.id, distance: Math.round(d) });
      stopToStations.set(s.stop_id, list);
      stopName.set(s.stop_id, s.stop_name);
    }
  }
  console.log(`  ${stopToStations.size} bus stops within ${RADIUS_M}m of a metro station`);

  // --- Stream stop_times, keeping only those stops --------------------------
  const tmp = mkdtempSync(join(tmpdir(), 'bmtc-'));
  const stopTimesPath = join(tmp, 'stop_times.txt');
  writeFileSync(stopTimesPath, zip.getEntry('stop_times.txt')!.getData());

  const tripRoute = new Map(trips.map((t) => [t.trip_id, t.route_id]));
  // `${stopId}|${routeId}` -> departure minutes
  const times = new Map<string, number[]>();
  // Longest observed stop sequence per route, used as its canonical path.
  // Short-turn trips would otherwise truncate the route.
  const routePath = new Map<string, Array<{ seq: number; stopId: string }>>();
  const tripSeq = new Map<string, Array<{ seq: number; stopId: string }>>();

  try {
    const rl = createInterface({
      input: createReadStream(stopTimesPath),
      crlfDelay: Infinity,
    });
    let header: string[] | null = null;
    let iStop = -1;
    let iTrip = -1;
    let iDep = -1;
    let iSeq = -1;

    for await (const line of rl) {
      if (!header) {
        header = line.replace(/^﻿/, '').split(',');
        iStop = header.indexOf('stop_id');
        iTrip = header.indexOf('trip_id');
        iDep = header.indexOf('departure_time');
        iSeq = header.indexOf('stop_sequence');
        if (iStop < 0 || iTrip < 0 || iDep < 0 || iSeq < 0) {
          throw new Error('BMTC stop_times.txt is missing expected columns');
        }
        continue;
      }
      // These rows contain no quoted commas, so a plain split is safe and much
      // faster than a full CSV parse over 1.5 million lines.
      const cols = line.split(',');
      const stopId = cols[iStop];
      const tripId = cols[iTrip];
      if (!stopId || !tripId) continue;

      // Every row contributes to the network path index, not just the rows
      // near a metro station — that index is what answers "which bus goes
      // from this stop to that one".
      const seqArr = tripSeq.get(tripId);
      if (seqArr) seqArr.push({ seq: Number(cols[iSeq]), stopId });
      else tripSeq.set(tripId, [{ seq: Number(cols[iSeq]), stopId }]);

      if (!stopToStations.has(stopId)) continue;
      const routeId = tripRoute.get(tripId);
      const dep = cols[iDep];
      if (!routeId || !dep) continue;
      const key = `${stopId}|${routeId}`;
      const arr = times.get(key);
      if (arr) arr.push(toMinutes(dep));
      else times.set(key, [toMinutes(dep)]);
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }

  // Collapse trips to one canonical path per route.
  for (const [tripId, rows] of tripSeq) {
    const routeId = tripRoute.get(tripId);
    if (!routeId) continue;
    const existing = routePath.get(routeId);
    if (!existing || rows.length > existing.length) routePath.set(routeId, rows);
  }

  // --- Aggregate per metro station, deduping a route across nearby stops ----
  const routeMeta = new Map(routes.map((r) => [r.route_id, r]));
  const perStation = new Map<string, Map<string, BusRoute>>();

  for (const [key, mins] of times) {
    const [stopId, routeId] = key.split('|');
    const meta = routeMeta.get(routeId);
    if (!meta || mins.length === 0) continue;
    mins.sort((a, b) => a - b);
    const first = mins[0];
    const last = mins[mins.length - 1];

    for (const { stationId, distance } of stopToStations.get(stopId) ?? []) {
      const byRoute = perStation.get(stationId) ?? new Map<string, BusRoute>();
      perStation.set(stationId, byRoute);
      const existing = byRoute.get(routeId);
      // The same route often stops at several stops near one station; keep the
      // closest one, since that is the one a rider would walk to.
      if (existing && existing.stopDistance <= distance) continue;
      byRoute.set(routeId, {
        route: meta.route_short_name || routeId,
        destinations: meta.route_long_name || '',
        stopName: stopName.get(stopId) ?? '',
        stopDistance: distance,
        trips: mins.length,
        firstBus: first,
        lastBus: last,
        // Average gap across the service span. The feed's per-trip times are
        // unreliable, but trip counts over a day are a fair frequency signal.
        headway: Math.max(1, Math.round((last - first) / Math.max(mins.length - 1, 1))),
      });
    }
  }

  const out: BusesByStation = {};
  for (const [stationId, byRoute] of perStation) {
    out[stationId] = [...byRoute.values()]
      .sort((a, b) => b.trips - a.trips || a.stopDistance - b.stopDistance)
      .slice(0, MAX_ROUTES);
  }

  // --- Whole-network index --------------------------------------------------
  // Only stops that some route actually serves; ~10k stops and ~4.4k routes,
  // which is small enough to fetch on demand in the browser.
  const usedStops = new Set<string>();
  const network: BusNetwork = { stops: {}, routes: {} };

  for (const [routeId, rows] of routePath) {
    const meta = routeMeta.get(routeId);
    if (!meta || rows.length < 2) continue;
    const seen = new Set<string>();
    const path = rows
      .sort((a, b) => a.seq - b.seq)
      .map((r) => r.stopId)
      // A loop route can list the same stop twice; keep the first visit so
      // "does A come before B" stays well defined.
      .filter((id) => !seen.has(id) && seen.add(id));
    if (path.length < 2) continue;
    network.routes[routeId] = {
      name: meta.route_short_name || routeId,
      long: meta.route_long_name || '',
      stops: path,
    };
    for (const id of path) usedStops.add(id);
  }

  for (const s of busStops) {
    if (!usedStops.has(s.stop_id)) continue;
    const lat = Number(s.stop_lat);
    const lon = Number(s.stop_lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    network.stops[s.stop_id] = {
      name: s.stop_name,
      lat: Number(lat.toFixed(5)),
      lon: Number(lon.toFixed(5)),
    };
  }

  console.log(
    `  network index: ${Object.keys(network.stops).length} stops, ` +
    `${Object.keys(network.routes).length} routes`,
  );

  return { byStation: out, network };
}

function haversineMetres(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLon / 2) ** 2 * Math.cos(toRad(aLat)) * Math.cos(toRad(bLat));
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}
