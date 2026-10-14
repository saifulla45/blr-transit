/**
 * Journey time, distance and interchange count between every pair of stations.
 *
 * Computed as a shortest-path problem rather than a straight line, because the
 * metro follows the track: Indiranagar to Majestic is 6.8 track-km through nine
 * stations, not the 5.5 km a crow flies. Cross-line journeys must also route
 * through an actual interchange and pay for the change.
 *
 * Nodes are (station, line) pairs so that changing lines is an explicit edge
 * with a cost, which is what makes the interchange count meaningful.
 */
import type { Row } from './gtfs';
import type { JourneyMatrix, LineId } from '../types/transit';

/** From transfers.txt: BMRCL allows 60s between platforms at its interchanges. */
const DEFAULT_TRANSFER_SEC = 60;

interface Edge { to: string; seconds: number; km: number; change: number }

export function buildJourneys(
  tables: Record<string, Row[]>,
  stationIds: string[],
  platformToStation: Map<string, string>,
): JourneyMatrix {
  const tripsById = new Map(tables.trips.map((t) => [t.trip_id, t]));
  const stationSet = new Set(stationIds);

  // --- Edges along each line, taken from consecutive stops on a trip --------
  // `${from}|${to}|${line}` -> best observed run
  const runs = new Map<string, { seconds: number; km: number }>();
  const byTrip = new Map<string, Row[]>();
  for (const st of tables.stop_times) {
    const arr = byTrip.get(st.trip_id);
    if (arr) arr.push(st);
    else byTrip.set(st.trip_id, [st]);
  }

  const nodesOnLine = new Map<LineId, Set<string>>();

  for (const [tripId, rows] of byTrip) {
    const trip = tripsById.get(tripId);
    if (!trip) continue;
    const line = trip.route_id as LineId;
    rows.sort((a, b) => Number(a.stop_sequence) - Number(b.stop_sequence));

    for (let i = 0; i < rows.length - 1; i++) {
      const a = rows[i];
      const b = rows[i + 1];
      const from = platformToStation.get(a.stop_id) ?? a.stop_id;
      const to = platformToStation.get(b.stop_id) ?? b.stop_id;
      if (from === to || !stationSet.has(from) || !stationSet.has(to)) continue;

      const seconds = toSeconds(b.arrival_time || b.departure_time)
        - toSeconds(a.departure_time || a.arrival_time);
      const km = Math.abs(Number(b.shape_dist_traveled) - Number(a.shape_dist_traveled));
      if (!Number.isFinite(seconds) || seconds <= 0 || !Number.isFinite(km)) continue;

      // Keep the fastest clean observation; dwell anomalies inflate the rest.
      for (const key of [`${from}|${to}|${line}`, `${to}|${from}|${line}`]) {
        const prev = runs.get(key);
        if (!prev || seconds < prev.seconds) runs.set(key, { seconds, km });
      }
      for (const s of [from, to]) {
        const set = nodesOnLine.get(line) ?? new Set<string>();
        set.add(s);
        nodesOnLine.set(line, set);
      }
    }
  }

  // --- Graph over (station, line) nodes ------------------------------------
  const adj = new Map<string, Edge[]>();
  const addEdge = (from: string, e: Edge) => {
    const list = adj.get(from) ?? [];
    list.push(e);
    adj.set(from, list);
  };

  for (const [key, run] of runs) {
    const [from, to, line] = key.split('|');
    addEdge(`${from}@${line}`, { to: `${to}@${line}`, seconds: run.seconds, km: run.km, change: 0 });
  }

  // Transfer edges: same station, different line. transfers.txt gives the real
  // platform-to-platform allowance where BMRCL publishes one.
  const transferSec = new Map<string, number>();
  for (const t of tables.transfers ?? []) {
    const station = platformToStation.get(t.from_stop_id) ?? t.from_stop_id;
    const secs = Number(t.min_transfer_time);
    if (Number.isFinite(secs)) {
      transferSec.set(station, Math.max(transferSec.get(station) ?? 0, secs));
    }
  }

  for (const station of stationIds) {
    const lines = [...nodesOnLine.entries()]
      .filter(([, set]) => set.has(station))
      .map(([line]) => line);
    if (lines.length < 2) continue;
    const cost = transferSec.get(station) ?? DEFAULT_TRANSFER_SEC;
    for (const a of lines) {
      for (const b of lines) {
        if (a === b) continue;
        addEdge(`${station}@${a}`, { to: `${station}@${b}`, seconds: cost, km: 0, change: 1 });
      }
    }
  }

  // --- Dijkstra from every station, over every line it sits on --------------
  const out: JourneyMatrix = {};

  for (const origin of stationIds) {
    const starts = [...nodesOnLine.entries()]
      .filter(([, set]) => set.has(origin))
      .map(([line]) => `${origin}@${line}`);
    if (starts.length === 0) continue;

    const best = new Map<string, { seconds: number; km: number; changes: number }>();
    // Predecessor per node, so the actual station path can be reconstructed —
    // that is what the journey diagram draws.
    const prevNode = new Map<string, string>();
    for (const s of starts) best.set(s, { seconds: 0, km: 0, changes: 0 });

    // A simple array-scan priority queue: the graph is ~90 nodes, so a heap
    // would cost more to maintain than it saves.
    const visited = new Set<string>();
    while (true) {
      let node: string | null = null;
      let bestSec = Infinity;
      for (const [n, v] of best) {
        if (!visited.has(n) && v.seconds < bestSec) { bestSec = v.seconds; node = n; }
      }
      if (!node) break;
      visited.add(node);

      for (const e of adj.get(node) ?? []) {
        const cur = best.get(node)!;
        const next = {
          seconds: cur.seconds + e.seconds,
          km: cur.km + e.km,
          changes: cur.changes + e.change,
        };
        const prev = best.get(e.to);
        if (!prev || next.seconds < prev.seconds) {
          best.set(e.to, next);
          prevNode.set(e.to, node);
        }
      }
    }

    // Collapse (station, line) results back to the best per destination.
    const row: JourneyMatrix[string] = {};
    const bestSeconds = new Map<string, number>();
    for (const [node, v] of best) {
      const station = node.split('@')[0];
      if (station === origin) continue;
      const prevBest = bestSeconds.get(station);
      if (prevBest !== undefined && v.seconds >= prevBest) continue;
      bestSeconds.set(station, v.seconds);

      // Walk the predecessors back to the origin, collapsing the (station,line)
      // nodes to plain stations so a line change does not repeat a station.
      const path: string[] = [];
      let cur: string | undefined = node;
      while (cur) {
        const st = cur.split('@')[0];
        if (path[0] !== st) path.unshift(st);
        cur = prevNode.get(cur);
      }

      row[station] = [
        Math.max(1, Math.round(v.seconds / 60)),
        Math.round(v.km * 10) / 10,
        v.changes,
        path,
      ];
    }
    out[origin] = row;
  }

  return out;
}

/** GTFS "HH:MM:SS" to seconds. Hours may exceed 24 for past-midnight service. */
function toSeconds(hhmmss: string): number {
  const p = hhmmss?.split(':');
  if (!p || p.length < 2) return NaN;
  return Number(p[0]) * 3600 + Number(p[1]) * 60 + Number(p[2] ?? '0');
}
