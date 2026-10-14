/**
 * Turns the BMRCL GTFS feed + BMRCL's parking page into the static JSON the app
 * ships. Run with `npm run build:data`.
 *
 * Design: everything is precomputed here so the browser does no parsing and the
 * site needs no backend. stop_times.txt alone is ~89k rows, so per-station
 * timetables are written as separate files and fetched on demand.
 */
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { fetchFeed, toMinutes } from './gtfs';
import { fetchParking } from './parking';
import { fetchPois } from './pois';
import { fetchBuses } from './buses';
import { buildJourneys } from './journeys';
import type {
  CalendarOverrides, DirectionId, DirectionInfo, FareMatrix, FareWindows, Line, LineId,
  NetworkStatus, ServicePattern, Station, StationEntrance, StationTimetable, StationsIndex,
} from '../types/transit';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, '..', 'public', 'data');
const PATTERNS: ServicePattern[] = ['weekday', 'monday', 'sunday', 'holiday'];

async function main() {
  console.log('Fetching GTFS feed and parking page...');
  const [feed, parking] = await Promise.all([fetchFeed(), fetchParking()]);
  const t = feed.tables;

  const required = ['stops', 'routes', 'trips', 'stop_times', 'calendar', 'feed_info'];
  for (const name of required) {
    if (!t[name]?.length) throw new Error(`GTFS feed is missing or has empty ${name}.txt`);
  }

  // --- Lines -----------------------------------------------------------------
  const lines: Line[] = t.routes.map((r) => ({
    id: r.route_id as LineId,
    name: r.route_short_name,
    color: `#${r.route_color || '666666'}`,
    // Yellow line ships an empty text_color; white on yellow is unreadable.
    textColor: `#${r.route_text_color || '000000'}`,
    order: [],
  }));

  // --- Stations --------------------------------------------------------------
  // location_type 1 = parent station. Platforms have an EMPTY location_type
  // (not "0"), which is valid GTFS and easy to get wrong.
  const stationRows = t.stops.filter((s) => s.location_type === '1');
  const platformToStation = new Map<string, string>();
  for (const s of t.stops) {
    if (s.parent_station) platformToStation.set(s.stop_id, s.parent_station);
  }

  // Which lines serve each station, derived from actual trips rather than assumed.
  const tripRoute = new Map(t.trips.map((tr) => [tr.trip_id, tr.route_id as LineId]));
  const stationLines = new Map<string, Set<LineId>>();
  for (const st of t.stop_times) {
    const stationId = platformToStation.get(st.stop_id) ?? st.stop_id;
    const route = tripRoute.get(st.trip_id);
    if (!route) continue;
    let set = stationLines.get(stationId);
    if (!set) { set = new Set(); stationLines.set(stationId, set); }
    set.add(route);
  }

  // Kannada names: BMRCL's own signage is bilingual, and the feed ships them.
  const kannada = new Map<string, string>();
  for (const r of t.translations ?? []) {
    if (r.table_name === 'stops' && r.field_name === 'stop_name' && r.language === 'kn') {
      if (r.record_id) kannada.set(r.record_id, r.translation);
    }
  }

  // How long from each entrance's fare gate to the platform. The feed models
  // only gates — no stairs, escalators or lifts — so this is a time, not a
  // step-free route.
  const gateSec = new Map<string, number>();
  for (const pw of t.pathways ?? []) {
    const secs = Number(pw.traversal_time);
    if (!Number.isFinite(secs)) continue;
    const prev = gateSec.get(pw.from_stop_id);
    if (prev === undefined || secs > prev) gateSec.set(pw.from_stop_id, secs);
  }

  // Street-level entrances (location_type 2), grouped by station. Coordinates
  // are what make "use Entrance C, 2 min walk" possible.
  const entrances = new Map<string, StationEntrance[]>();
  for (const s of t.stops) {
    if (s.location_type !== '2' || !s.parent_station) continue;
    const lat = Number(s.stop_lat);
    const lon = Number(s.stop_lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const list = entrances.get(s.parent_station) ?? [];
    // Names arrive as "Attiguppe – Entrance A"; the station name is already
    // the page title, so keep only the part that distinguishes them.
    const label = s.stop_name.split(/\s[–-]\s/).pop()?.trim() || s.stop_name;
    const secs = gateSec.get(s.stop_id);
    list.push({
      id: s.stop_id,
      name: label,
      lat: Number(lat.toFixed(6)),
      lon: Number(lon.toFixed(6)),
      ...(secs ? { toPlatformSec: secs } : {}),
    });
    entrances.set(s.parent_station, list);
  }
  for (const list of entrances.values()) list.sort((a, b) => a.name.localeCompare(b.name));

  const stations: Station[] = stationRows.map((s) => {
    const ls = [...(stationLines.get(s.stop_id) ?? [])];
    const station: Station = {
      id: s.stop_id,
      name: s.stop_name,
      lat: Number(s.stop_lat),
      lon: Number(s.stop_lon),
      lines: ls,
      isInterchange: ls.length > 1,
      wheelchair: s.wheelchair_boarding === '1',
    };
    const kn = kannada.get(s.stop_id);
    if (kn) station.nameKn = kn;
    const ents = entrances.get(s.stop_id);
    if (ents?.length) station.entrances = ents;
    const p = parking.byStation[s.stop_id];
    if (p) station.parking = p;
    return station;
  }).sort((a, b) => a.name.localeCompare(b.name));

  assert(stations.length > 0, 'No stations parsed from stops.txt');
  for (const s of stations) {
    assert(Number.isFinite(s.lat) && Number.isFinite(s.lon), `Station ${s.id} has bad coordinates`);
    assert(s.lines.length > 0, `Station ${s.id} (${s.name}) is served by no route`);
  }

  // Every parking entry must land on a real station, or the alias file is wrong.
  const stationIds = new Set(stations.map((s) => s.id));
  for (const id of Object.keys(parking.byStation)) {
    assert(stationIds.has(id), `parking-aliases.json maps to unknown station "${id}"`);
  }

  // --- Station order along each line -----------------------------------------
  // Taken from the longest trip on the line, so short-loop services do not
  // truncate it. Drives the "previous / next station" strip.
  {
    const longestTrip = new Map<LineId, { tripId: string; stops: number }>();
    const tripStopCount = new Map<string, number>();
    for (const st of t.stop_times) {
      tripStopCount.set(st.trip_id, (tripStopCount.get(st.trip_id) ?? 0) + 1);
    }
    for (const trip of t.trips) {
      if (trip.direction_id !== '0') continue;
      const line = trip.route_id as LineId;
      const stops = tripStopCount.get(trip.trip_id) ?? 0;
      const best = longestTrip.get(line);
      if (!best || stops > best.stops) longestTrip.set(line, { tripId: trip.trip_id, stops });
    }
    const seqByTrip = new Map<string, Array<{ seq: number; stationId: string }>>();
    const wanted = new Set([...longestTrip.values()].map((v) => v.tripId));
    for (const st of t.stop_times) {
      if (!wanted.has(st.trip_id)) continue;
      const arr = seqByTrip.get(st.trip_id) ?? [];
      arr.push({
        seq: Number(st.stop_sequence),
        stationId: platformToStation.get(st.stop_id) ?? st.stop_id,
      });
      seqByTrip.set(st.trip_id, arr);
    }
    for (const line of lines) {
      const best = longestTrip.get(line.id);
      if (!best) continue;
      const seen = new Set<string>();
      line.order = (seqByTrip.get(best.tripId) ?? [])
        .sort((a, b) => a.seq - b.seq)
        .map((x) => x.stationId)
        .filter((id) => !seen.has(id) && seen.add(id));
      assert(line.order.length > 1, `Line ${line.id} produced no station order`);
    }
  }

  // --- Timetables ------------------------------------------------------------
  const tripsById = new Map(t.trips.map((tr) => [tr.trip_id, tr]));

  // Which platform a given direction departs from. Answers the question you
  // actually have in the ten seconds after tapping in.
  const platformOf = new Map<string, string>();
  for (const s of t.stops) {
    if (s.platform_code) platformOf.set(s.stop_id, s.platform_code);
  }
  const platformFor = new Map<string, string>();   // `${station}|${line}:${dir}`

  // A trip's last stop is where it terminates. Those rows carry a departure_time
  // in GTFS but you cannot board there, so counting them would advertise
  // "next train to Whitefield" to someone already standing at Whitefield.
  const lastSeq = new Map<string, number>();
  for (const st of t.stop_times) {
    const seq = Number(st.stop_sequence);
    const prev = lastSeq.get(st.trip_id);
    if (prev === undefined || seq > prev) lastSeq.set(st.trip_id, seq);
  }
  // stationId -> pattern -> `${line}:${direction}` -> minutes
  const acc = new Map<string, Map<ServicePattern, Map<string, Set<number>>>>();
  const headsigns = new Map<string, string>();   // `${stationId}|${pattern}|${line}:${dir}`

  for (const st of t.stop_times) {
    const trip = tripsById.get(st.trip_id);
    if (!trip) continue;
    const pattern = trip.service_id as ServicePattern;
    if (!PATTERNS.includes(pattern)) continue;

    if (Number(st.stop_sequence) === lastSeq.get(st.trip_id)) continue;

    const stationId = platformToStation.get(st.stop_id) ?? st.stop_id;
    if (!stationIds.has(stationId)) continue;

    const dir = (trip.direction_id || '0') as DirectionId;
    // Keyed by line, direction AND headsign. Two reasons:
    //  - at Majestic and RV Road two lines share both direction ids, so
    //    direction alone merges Purple departures into the Green bucket;
    //  - some Purple trips short-loop to Baiyappanahalli instead of running to
    //    Whitefield, so one direction genuinely has two destinations and a
    //    rider needs to know which train is which.
    const headsign = st.stop_headsign || trip.trip_headsign || '';
    const key = `${trip.route_id}:${dir}:${headsign}`;
    const time = st.departure_time || st.arrival_time;
    if (!time) continue;

    let byPattern = acc.get(stationId);
    if (!byPattern) { byPattern = new Map(); acc.set(stationId, byPattern); }
    let byDir = byPattern.get(pattern);
    if (!byDir) { byDir = new Map(); byPattern.set(pattern, byDir); }
    let times = byDir.get(key);
    if (!times) { times = new Set(); byDir.set(key, times); }
    times.add(toMinutes(time));

    headsigns.set(`${stationId}|${pattern}|${key}`, headsign);

    // Which platform this direction leaves from. Recorded here because this is
    // the only place we see the platform-level stop_id alongside its trip.
    const pf = platformOf.get(st.stop_id);
    if (pf) platformFor.set(`${stationId}|${trip.route_id}:${dir}`, pf);
  }

  rmSync(join(OUT, 'stations'), { recursive: true, force: true });
  mkdirSync(join(OUT, 'stations'), { recursive: true });

  let written = 0;
  for (const station of stations) {
    const byPattern = acc.get(station.id);
    assert(byPattern, `Station ${station.id} (${station.name}) has no departures at all`);

    const schedule = {} as StationTimetable['schedule'];
    for (const pattern of PATTERNS) {
      const byDir = byPattern.get(pattern);
      const out: DirectionInfo[] = [];
      for (const [key, times] of byDir ?? []) {
        if (!times.size) continue;
        const [line, direction] = key.split(':') as [LineId, DirectionId];
        const platform = platformFor.get(`${station.id}|${line}:${direction}`);
        out.push({
          line,
          direction,
          ...(platform ? { platform } : {}),
          headsign: headsigns.get(`${station.id}|${pattern}|${key}`) ?? '',
          departures: [...times].sort((a, b) => a - b),
        });
      }
      // Most-frequent destination first, so the main service leads the list.
      out.sort((a, b) => a.line.localeCompare(b.line) || a.direction.localeCompare(b.direction) || b.departures.length - a.departures.length);
      assert(out.length > 0, `Station ${station.id} (${station.name}) has no ${pattern} service`);
      // An interchange must expose both lines, or the merge bug is back.
      const distinctLines = new Set(out.map((d) => d.line)).size;
      assert(
        distinctLines === station.lines.length,
        `Station ${station.id} (${station.name}) serves ${station.lines.length} line(s) ` +
        `but its ${pattern} timetable only has ${distinctLines}`,
      );
      // Terminus stations legitimately have one boardable direction; every
      // other station must offer both, or trips are being dropped.
      for (const d of out) {
        assert(d.departures.length > 0, `${station.name} ${d.line} dir${d.direction} is empty`);
      }
      schedule[pattern] = out;
    }

    const timetable: StationTimetable = { id: station.id, name: station.name, schedule };
    writeFileSync(join(OUT, 'stations', `${station.id}.json`), JSON.stringify(timetable));
    written++;
  }

  // Sunday timetables must differ from weekday ones; if they match, the
  // calendar join silently collapsed and every Sunday would show wrong times.
  const sample = stations.find((s) => s.id === 'KGWA') ?? stations[0];
  const s0 = acc.get(sample.id)!;
  const firstKey = [...(s0.get('weekday')?.keys() ?? [])][0];
  const wk = s0.get('weekday')?.get(firstKey)?.size ?? 0;
  const su = s0.get('sunday')?.get(firstKey)?.size ?? 0;
  assert(wk !== su, `weekday and sunday trip counts are identical (${wk}) at ${sample.name} — calendar join looks wrong`);

  // --- Network-wide service span ---------------------------------------------
  // Lets the home page say whether the network is running right now without
  // loading all 83 timetables into the browser.
  const network: NetworkStatus = { patterns: {} as NetworkStatus['patterns'] };
  for (const pattern of PATTERNS) {
    let first = Infinity;
    let last = -Infinity;
    for (const byPattern of acc.values()) {
      for (const times of byPattern.get(pattern)?.values() ?? []) {
        for (const t of times) { if (t < first) first = t; if (t > last) last = t; }
      }
    }
    network.patterns[pattern] = {
      firstTrain: first === Infinity ? 0 : first,
      lastTrain: last === -Infinity ? 0 : last,
      trips: t.trips.filter((tr) => tr.service_id === pattern).length,
    };
  }

  // A silently-empty map here would just mean no platform ever renders, with
  // no error — which is exactly how this was broken the first time.
  assert(platformFor.size > 0, 'No platforms resolved from stops.platform_code');

  // --- Calendar overrides ----------------------------------------------------
  // BMRCL runs the holiday timetable on 2nd/4th Saturdays and public holidays.
  // Without this, ~40 days a year would show the wrong schedule.
  const overrides: CalendarOverrides = {};
  for (const r of t.calendar_dates ?? []) {
    if (r.exception_type !== '1') continue;   // 1 = service added on this date
    const d = r.date;
    overrides[`${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`] = r.service_id as ServicePattern;
  }

  // --- Fares -----------------------------------------------------------------
  // GTFS-Fares v2: fare_leg_rules maps (origin, destination, timeframe) to a
  // product, and each product names its payment medium and price. Token and QR
  // are always the same and time-invariant; only the smart card varies, so one
  // "base" plus the two smart-card prices captures the whole model.
  const productPrice = new Map<string, { media: string; amount: number }>();
  for (const p of t.fare_products ?? []) {
    productPrice.set(p.fare_product_id, {
      media: p.fare_media_id,
      amount: Number(p.amount),
    });
  }

  const fares: FareMatrix = {};
  {
    const acc = new Map<string, { base?: number; peak?: number; off?: number }>();
    for (const r of t.fare_leg_rules ?? []) {
      const prod = productPrice.get(r.fare_product_id);
      if (!prod || !r.from_area_id || !r.to_area_id) continue;
      const key = `${r.from_area_id}|${r.to_area_id}`;
      const entry = acc.get(key) ?? {};
      if (prod.media === 'smartcard') {
        if (r.from_timeframe_group_id === 'peak') entry.peak = prod.amount;
        else entry.off = prod.amount;
      } else if (prod.media === 'token') {
        entry.base = prod.amount;
      }
      acc.set(key, entry);
    }
    for (const [key, v] of acc) {
      const [from, to] = key.split('|');
      if (v.base === undefined) continue;
      (fares[from] ??= {})[to] = [
        v.base,
        v.peak ?? v.base,
        v.off ?? v.peak ?? v.base,
      ];
    }
  }

  // Fall back to the legacy fare_rules if the v2 tables are ever absent.
  if (Object.keys(fares).length === 0) {
    const legacy = new Map(t.fare_attributes.map((f) => [f.fare_id, Number(f.price)]));
    for (const r of t.fare_rules ?? []) {
      const price = legacy.get(r.fare_id);
      if (price === undefined || !r.origin_id || !r.destination_id) continue;
      (fares[r.origin_id] ??= {})[r.destination_id] = [price, price, price];
    }
  }
  assert(Object.keys(fares).length > 0, 'No fares parsed from either fares v1 or v2');

  // --- Travel passes ---------------------------------------------------------
  // The tourist card is not a per-journey fare — it has no leg rules at all.
  // It is an unlimited-travel pass, so it is modelled separately and shown
  // with a break-even rather than as a fourth way to pay for one trip.
  const passes = (t.fare_products ?? [])
    .filter((p) => p.fare_media_id === 'touristcard')
    .map((p) => ({
      id: p.fare_product_id,
      name: p.fare_product_name,
      // "pass_3day" -> 3
      days: Number(/(\d+)/.exec(p.fare_product_id)?.[1] ?? '1'),
      amount: Number(p.amount),
    }))
    .sort((a, b) => a.days - b.days);

  // --- Peak windows ----------------------------------------------------------
  const fareWindows = {} as FareWindows;
  for (const pattern of PATTERNS) fareWindows[pattern] = [];
  for (const tf of t.timeframes ?? []) {
    const pattern = tf.service_id as ServicePattern;
    if (!PATTERNS.includes(pattern)) continue;
    fareWindows[pattern].push({
      from: toMinutes(tf.start_time),
      to: toMinutes(tf.end_time),
      peak: tf.timeframe_group_id === 'peak',
    });
  }
  for (const pattern of PATTERNS) {
    fareWindows[pattern].sort((a, b) => a.from - b.from);
  }

  // --- Journey times, distances and interchanges -----------------------------
  const journeys = buildJourneys(t, stations.map((s) => s.id), platformToStation);
  {
    // A fare exists for every pair, so a journey must too — otherwise the graph
    // is disconnected and some destination would show a fare but no time.
    const missing: string[] = [];
    for (const from of stations) {
      for (const to of stations) {
        if (from.id === to.id) continue;
        if (!journeys[from.id]?.[to.id]) missing.push(`${from.id}->${to.id}`);
      }
    }
    assert(
      missing.length === 0,
      `${missing.length} station pairs have no journey (e.g. ${missing.slice(0, 3).join(', ')})`,
    );
  }

  // --- Line geometry ---------------------------------------------------------
  const shapesById = new Map<string, Array<[number, number, number]>>();
  for (const s of t.shapes ?? []) {
    const arr = shapesById.get(s.shape_id) ?? [];
    arr.push([Number(s.shape_pt_lon), Number(s.shape_pt_lat), Number(s.shape_pt_sequence)]);
    shapesById.set(s.shape_id, arr);
  }
  // One representative shape per line keeps the GeoJSON small; drawing every
  // trip variant would repeat the same track dozens of times.
  const shapeForLine = new Map<LineId, string>();
  for (const trip of t.trips) {
    const line = trip.route_id as LineId;
    const existing = shapeForLine.get(line);
    const candidate = trip.shape_id;
    if (!candidate) continue;
    if (!existing || (shapesById.get(candidate)?.length ?? 0) > (shapesById.get(existing)?.length ?? 0)) {
      shapeForLine.set(line, candidate);
    }
  }
  const geojson = {
    type: 'FeatureCollection' as const,
    features: [...shapeForLine.entries()].map(([lineId, shapeId]) => {
      const line = lines.find((l) => l.id === lineId)!;
      const pts = (shapesById.get(shapeId) ?? []).sort((a, b) => a[2] - b[2]);
      return {
        type: 'Feature' as const,
        properties: { line: lineId, name: line.name, color: line.color },
        geometry: { type: 'LineString' as const, coordinates: pts.map(([lon, lat]) => [lon, lat]) },
      };
    }),
  };

  // --- Write -----------------------------------------------------------------
  const feedVersion = t.feed_info[0]?.feed_version ?? 'unknown';
  const index: StationsIndex = {
    // Version string busts the CDN cache; public/data files are not
    // content-hashed by Next, so without this a refresh never reaches users.
    version: `${feedVersion}-${feed.sourceCommit}`,
    feedVersion,
    sourceCommit: feed.sourceCommit,
    generatedAt: new Date().toISOString(),
    lines,
    stations,
  };

  writeFileSync(join(OUT, 'stations.json'), JSON.stringify(index));
  writeFileSync(join(OUT, 'fares.json'), JSON.stringify(fares));
  writeFileSync(join(OUT, 'fare-windows.json'), JSON.stringify(fareWindows));
  writeFileSync(join(OUT, 'passes.json'), JSON.stringify(passes));
  writeFileSync(join(OUT, 'journeys.json'), JSON.stringify(journeys));
  writeFileSync(join(OUT, 'calendar-overrides.json'), JSON.stringify(overrides));
  writeFileSync(join(OUT, 'lines.geojson'), JSON.stringify(geojson));
  writeFileSync(join(OUT, 'network.json'), JSON.stringify(network));

  // Buses: tolerated if they fail, like POIs. The BMTC feed is a 44 MB download
  // and the largest single dependency in this pipeline.
  let busRoutes = 0;
  let busStations = 0;
  try {
    console.log('Fetching BMTC bus routes...');
    const buses = await fetchBuses(stations);
    writeFileSync(join(OUT, 'buses.json'), JSON.stringify(buses.byStation));
    // Fetched on demand by the journey search, not on first paint.
    writeFileSync(join(OUT, 'bus-network.json'), JSON.stringify(buses.network));
    busRoutes = Object.values(buses.byStation).reduce((n, list) => n + list.length, 0);
    busStations = Object.values(buses.byStation).filter((l) => l.length).length;
  } catch (err) {
    console.warn(`  WARNING: bus routes skipped (${err instanceof Error ? err.message : err}).`);
  }

  // POIs last, and tolerated if they fail: Overpass is the slowest and least
  // reliable dependency here, and it must never cost us a good transit build.
  let poiCount = 0;
  let noPois = stations.length;
  try {
    console.log('Fetching nearby places from OpenStreetMap...');
    const pois = await fetchPois(stations);
    writeFileSync(join(OUT, 'pois.json'), JSON.stringify(pois));
    poiCount = Object.values(pois).reduce((n, list) => n + list.length, 0);
    noPois = stations.filter((s) => !pois[s.id]?.length).length;
  } catch (err) {
    console.warn(`  WARNING: nearby places skipped (${err instanceof Error ? err.message : err}).`);
    console.warn('  Transit data above is complete; re-run to retry the places layer.');
  }

  const withParking = stations.filter((s) => s.parking).length;
  console.log(`
  feed version   ${feedVersion}  (source commit ${feed.sourceCommit})
  lines          ${lines.length}
  stations       ${stations.length}  (${written} timetables written)
  interchanges   ${stations.filter((s) => s.isInterchange).map((s) => s.name).join(', ')}
  line order     ${lines.map((l) => `${l.name} ${l.order.length}`).join(', ')}
  parking        ${withParking} stations have parking, ${stations.length - withParking} do not
  platforms      ${platformFor.size} (station, line, direction) combinations
  kannada        ${stations.filter((s) => s.nameKn).length} stations have a Kannada name
  entrances      ${stations.reduce((n, s) => n + (s.entrances?.length ?? 0), 0)} across ${stations.filter((s) => s.entrances?.length).length} stations
  fares          ${Object.keys(fares).length} origins
  passes         ${passes.map((p) => `${p.days}d ₹${p.amount}`).join(', ') || 'none'}
  journeys       ${Object.values(journeys).reduce((n, r) => n + Object.keys(r).length, 0)} pairs (time, track km, interchanges)
  overrides      ${Object.keys(overrides).length} dates use a non-default timetable
  service span   weekday ${Math.floor(network.patterns.weekday.firstTrain / 60)}:${String(network.patterns.weekday.firstTrain % 60).padStart(2, '0')}-${Math.floor(network.patterns.weekday.lastTrain / 60)}:${String(network.patterns.weekday.lastTrain % 60).padStart(2, '0')}, ${network.patterns.weekday.trips} trips
  buses          ${busRoutes} routes across ${busStations} stations
  nearby         ${poiCount} POIs across ${stations.length - noPois} stations (${noPois} with none)
`);
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`Data validation failed: ${msg}`);
}

main().catch((err) => {
  console.error(`\n${err instanceof Error ? err.message : err}\n`);
  process.exit(1);
});
