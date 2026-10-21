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
import { normalizeName } from './search';

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

  /*
    One entry per place, nearest side kept. BMTC lists each direction and
    shelter as its own stop, so the picker offered "Hoodi · 445 m",
    "Hoodi · 448 m", "Hoodi · 450 m" and filled every slot with one
    junction while genuinely different stops fell off the end.
  */
  const seen = new Set<string>();
  return out
    .sort((a, b) => a.distance - b.distance)
    .filter((s) => {
      const key = s.name.trim().toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}

/** Stops whose name matches a query, for picking a destination. */
/**
 * Every distinct place matching a query.
 *
 * Two bugs this replaces, both of which lost real results.
 *
 * It used to stop scanning after `limit * 6` hits. Object key order is
 * arbitrary, so for anything common the scan ended before reaching the
 * stop you actually wanted and ranking never saw it. A full pass over
 * 9,000 stops is well under a millisecond; there was nothing to save.
 *
 * And it returned raw stops, so one place appeared many times — BMTC lists
 * every direction and shelter separately, which is why the picker offered
 * "Hoodi" four times and filled the list with one junction. Results are
 * now deduplicated by name, so eight suggestions mean eight places.
 */
export function searchStops(network: BusNetwork, query: string, limit = 10): NearbyStop[] {
  const raw = query.trim().toLowerCase();
  if (raw.length < 2) return [];

  /*
    Matched on the normalised form, which folds spelling apart from case.

    Plain substring matching returned NOTHING for "Whitefield", because
    BMTC writes it "White Field Bus Station" — a space the searcher cannot
    be expected to guess. normalizeName also folds the usual Indian
    transliteration pairs, so Yeshwantpur and Yeswanthpura meet.
  */
  const needle = normalizeName(raw);
  if (!needle) return [];

  const best = new Map<string, { stop: NearbyStop; rank: number }>();

  for (const [id, s] of Object.entries(network.stops)) {
    const name = normalizeName(s.name);
    const at = name.indexOf(needle);
    if (at < 0) continue;

    /*
      Ranked by how the match sits in the name, not merely where:
      the whole name, then the start of it, then the start of any word,
      then anywhere. "Hebbala" should beat "Dasarahalli Hebbala", and both
      should beat a stop that merely contains the letters.
    */
    /*
      Word-start can no longer be detected from the normalised string,
      which has no separators left, so it is checked on the original.
    */
    const rawName = s.name.toLowerCase();
    const rawAt = rawName.indexOf(raw);
    const rank = name === needle ? 0
      : at === 0 ? 1
      : rawAt > 0 && /[^a-z0-9]/.test(rawName[rawAt - 1] ?? '') ? 2
      : 3;

    const key = rawName.trim();
    const existing = best.get(key);
    if (!existing || rank < existing.rank) {
      best.set(key, { stop: { id, name: s.name, lat: s.lat, lon: s.lon, distance: 0 }, rank });
    }
  }

  if (best.size > 0) {
    return [...best.values()]
      .sort((a, b) => a.rank - b.rank || a.stop.name.length - b.stop.name.length
        || a.stop.name.localeCompare(b.stop.name))
      .slice(0, limit)
      .map((e) => e.stop);
  }

  /*
    Nothing matched literally, so fall back to similarity.

    Normalising spelling is not enough on its own: BMTC writes Yeshwantpur
    as "Yeshwanthapura", and no amount of fold-the-letters gets one
    substring inside the other. Returning nothing there is the worst
    outcome — the stop exists, the searcher spelled it the way everybody
    spells it, and the app says no such place.

    Trigram overlap is used rather than edit distance because it is
    tolerant of inserted syllables, which is exactly how these variants
    differ, and because it stays cheap over 9,000 names.
  */
  return fuzzyStops(network, needle, limit);
}

/** Dice coefficient over character trigrams. */
function similarity(a: string, b: string): number {
  if (a.length < 3 || b.length < 3) return a === b ? 1 : 0;
  const grams = (x: string) => {
    const set = new Set<string>();
    for (let i = 0; i < x.length - 2; i += 1) set.add(x.slice(i, i + 3));
    return set;
  };
  const A = grams(a);
  const B = grams(b);
  let shared = 0;
  for (const g of A) if (B.has(g)) shared += 1;
  return (2 * shared) / (A.size + B.size);
}

/** Close-enough matches, used only when nothing matched literally. */
function fuzzyStops(network: BusNetwork, needle: string, limit: number): NearbyStop[] {
  const MIN = 0.42;
  const best = new Map<string, { stop: NearbyStop; score: number }>();

  /*
    Cheap gate before the expensive scoring.

    Dice over every one of 9,000 names cost 60-74ms here, which is roughly
    300ms per keystroke on a mid-range Android — jank you can feel while
    typing. Requiring the first three normalised characters to appear
    somewhere in the name is one indexOf, discards almost everything, and
    keeps the variants this exists for: "yes" is present in
    "csyesvanthapuracircle".

    The trade is that a typo in the first three characters falls through.
    This is a fallback for spelling variants, not a spell checker.
  */
  const gate = needle.slice(0, 3);

  for (const [id, s] of Object.entries(network.stops)) {
    const name = normalizeName(s.name);
    if (!name.includes(gate)) continue;
    // Compare against the whole name and each word, so a long name is not
    // penalised for the parts the searcher did not type.
    let score = similarity(needle, name);
    for (const word of s.name.toLowerCase().split(/[^a-z0-9]+/)) {
      const w = normalizeName(word);
      if (w.length >= 3) score = Math.max(score, similarity(needle, w));
    }
    if (score < MIN) continue;

    const key = s.name.trim().toLowerCase();
    const existing = best.get(key);
    if (!existing || score > existing.score) {
      best.set(key, { stop: { id, name: s.name, lat: s.lat, lon: s.lon, distance: 0 }, score });
    }
  }

  return [...best.values()]
    .sort((a, b) => b.score - a.score || a.stop.name.length - b.stop.name.length)
    .slice(0, limit)
    .map((e) => e.stop);
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

/**
 * Every stop that counts as "this place".
 *
 * Exact name equality was not enough and failed silently. BMTC names the
 * stops around one junction separately -- Hebbala, Hebbala Bridge, Hebbala
 * Canara Bank, Depot-28 Hebbala -- so picking "Hebbala" matched one of them
 * and missed the twelve routes that genuinely run there via "Hebbala
 * Bridge". The search then reported "no direct bus" about a journey with a
 * dozen direct options.
 *
 * Three ways in, unioned:
 *   the same name, which catches both directions of one stop;
 *   a name containing the target as a whole word, for the Bridge/Canara
 *   Bank siblings;
 *   anything within WALK_M of a stop already matched, which catches
 *   siblings BMTC named differently altogether.
 *
 * Proximity is anchored to the name matches rather than applied blindly, so
 * a dense interchange does not swallow half the city.
 */
const LOCALITY_WALK_M = 450;

export function stopsInLocality(network: BusNetwork, stop: NearbyStop): Set<string> {
  const target = stop.name.trim().toLowerCase();
  const ids = new Set<string>([stop.id]);
  const anchors: Array<{ lat: number; lon: number }> = [];

  for (const [id, s] of Object.entries(network.stops)) {
    const name = s.name.trim().toLowerCase();
    // Whole-word containment, so "Hebbala" matches "Hebbala Bridge" but
    // never a different place that merely shares a substring.
    const words = name.split(/[^a-z0-9]+/);
    if (name === target || words.includes(target)) {
      ids.add(id);
      anchors.push(s);
    }
  }
  if (anchors.length === 0) anchors.push(stop);

  for (const [id, s] of Object.entries(network.stops)) {
    if (ids.has(id)) continue;
    for (const a of anchors) {
      if (haversineMetres(a.lat, a.lon, s.lat, s.lon) <= LOCALITY_WALK_M) { ids.add(id); break; }
    }
  }

  return ids;
}

/** Kept for the station page, which only has a name to work from. */
export function stopIdsNamed(network: BusNetwork, name: string): Set<string> {
  const target = name.trim().toLowerCase();
  const ids = new Set<string>();
  for (const [id, s] of Object.entries(network.stops)) {
    if (s.name.trim().toLowerCase() === target) ids.add(id);
  }
  return ids;
}

export interface ChangeJourney {
  first: DirectBus;
  second: DirectBus;
  /** Where you get off the first bus and on to the second. */
  changeAt: string;
  totalStops: number;
}

/**
 * One-change journeys, for when nothing runs the whole way.
 *
 * "No direct bus" is a dead end, and in a city this size it is also the
 * common case -- the honest next sentence is which two buses to take. This
 * finds routes leaving the origin and routes arriving at the destination
 * that share a stop, with the change happening after you board and before
 * you alight.
 *
 * Cheap enough to run in the browser: the candidate route lists are a few
 * dozen each, not the full 4,400.
 */
export function findChangeJourneys(
  network: BusNetwork,
  fromIds: Set<string>,
  toIds: Set<string>,
  limit = 6,
): ChangeJourney[] {
  const fromRoutes: Array<[string, number]> = [];
  const toRoutes: Array<[string, number]> = [];

  for (const [routeId, route] of Object.entries(network.routes)) {
    const board = route.stops.findIndex((id) => fromIds.has(id));
    if (board >= 0) fromRoutes.push([routeId, board]);
    const alight = route.stops.findIndex((id) => toIds.has(id));
    if (alight >= 0) toRoutes.push([routeId, alight]);
  }

  const out: ChangeJourney[] = [];
  const seen = new Set<string>();

  for (const [aId, board] of fromRoutes) {
    const a = network.routes[aId];
    // Everything reachable on the first bus, with how far along it is.
    const downstream = new Map<string, number>();
    for (let i = board + 1; i < a.stops.length; i += 1) {
      if (!downstream.has(a.stops[i])) downstream.set(a.stops[i], i);
    }

    for (const [bId, alight] of toRoutes) {
      if (bId === aId) continue;
      const b = network.routes[bId];

      for (let j = 0; j < alight; j += 1) {
        const at = downstream.get(b.stops[j]);
        if (at === undefined) continue;

        // One entry per pair of route NAMES: BMTC lists many near-identical
        // variants of the same service and they would otherwise fill the list.
        const key = `${a.name}|${b.name}`;
        if (seen.has(key)) break;
        seen.add(key);

        out.push({
          first: leg(network, aId, a, board, at),
          second: leg(network, bId, b, j, alight),
          changeAt: network.stops[b.stops[j]]?.name ?? b.stops[j],
          totalStops: (at - board) + (alight - j),
        });
        break;
      }
    }
  }

  return out.sort((x, y) => x.totalStops - y.totalStops).slice(0, limit);
}

function leg(
  network: BusNetwork,
  routeId: string,
  route: BusNetwork['routes'][string],
  from: number,
  to: number,
): DirectBus {
  return {
    routeId,
    name: route.name,
    long: route.long,
    boardStopId: route.stops[from],
    alightStopId: route.stops[to],
    stopCount: to - from,
    path: route.stops.slice(from, to + 1).map((id) => network.stops[id]?.name ?? id),
  };
}
