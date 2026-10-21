/**
 * Where every train is, according to the timetable.
 *
 * A train is fully described by the moment it left its terminus: given the
 * cumulative travel time to each station, its position at any later instant
 * is arithmetic. So the whole network's state comes from a few departure
 * lists rather than a position feed.
 *
 * These are SCHEDULED positions. BMRCL publishes no realtime data, so this
 * is where a train is meant to be, not where it is. Every surface that shows
 * them has to say so.
 */

export interface LiveLine {
  id: string;
  name: string;
  stations: Array<{ id: string; name: string; lat: number; lon: number }>;
  offsets: number[];
  runs: Record<string, { '0': number[]; '1': number[] }>;
}

export interface LiveNetwork { lines: LiveLine[] }

export interface TrainPosition {
  line: string;
  direction: '0' | '1';
  /** Index of the station just behind, and progress 0..1 to the next. */
  from: number;
  to: number;
  t: number;
  /** Minutes until it reaches the end of the line. */
  remaining: number;
}

/**
 * Trains on one line at `minutes` past midnight.
 *
 * `minutes` can exceed 1440 for the post-midnight tail, matching how the
 * timetables store late services. Departures from the previous service day
 * are checked too, because a train that left at 23:50 is still running at
 * 00:10 and would otherwise vanish from the map at midnight.
 */
export function trainsOnLine(line: LiveLine, pattern: string, minutes: number): TrainPosition[] {
  const runs = line.runs[pattern];
  if (!runs) return [];

  const total = line.offsets[line.offsets.length - 1] ?? 0;
  const out: TrainPosition[] = [];

  for (const direction of ['0', '1'] as const) {
    for (const departure of runs[direction]) {
      // Today's run, and yesterday's late one still in motion.
      for (const now of [minutes, minutes + 1440]) {
        const elapsed = now - departure;
        if (elapsed < 0 || elapsed > total) continue;

        // Both directions reduce to a scalar position in offset-space.
        const pos = direction === '0' ? elapsed : total - elapsed;
        const placed = interpolate(line.offsets, pos);
        if (placed) {
          out.push({
            line: line.id,
            direction,
            from: placed.from,
            to: placed.to,
            t: placed.t,
            remaining: total - elapsed,
          });
        }
        break;
      }
    }
  }

  return out;
}

/** Bracket `pos` between two station offsets and return the fraction between. */
function interpolate(
  offsets: number[],
  pos: number,
): { from: number; to: number; t: number } | null {
  if (pos <= 0) return { from: 0, to: Math.min(1, offsets.length - 1), t: 0 };
  const last = offsets.length - 1;
  if (pos >= offsets[last]) return { from: Math.max(0, last - 1), to: last, t: 1 };

  for (let i = 0; i < last; i += 1) {
    if (pos >= offsets[i] && pos <= offsets[i + 1]) {
      const span = offsets[i + 1] - offsets[i];
      // Zero-length hops exist where two stations share a scheduled minute.
      return { from: i, to: i + 1, t: span === 0 ? 0 : (pos - offsets[i]) / span };
    }
  }
  return null;
}

/** Total trains moving across the network right now. */
export function countRunning(net: LiveNetwork, pattern: string, minutes: number): number {
  return net.lines.reduce((n, l) => n + trainsOnLine(l, pattern, minutes).length, 0);
}

/**
 * Equirectangular projection into a unit box.
 *
 * Bengaluru spans about 0.4 degrees, where the error from treating lat/lon
 * as planar is far below a pixel. The cos(lat) term keeps the network from
 * looking horizontally stretched.
 */
export function project(
  stations: Array<{ lat: number; lon: number }>,
): {
  toXY: (lat: number, lon: number) => { x: number; y: number };
  /** height / width of the network's bounding box, for the viewBox. */
  aspect: number;
} {
  const lats = stations.map((s) => s.lat);
  const lons = stations.map((s) => s.lon);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);

  const k = Math.cos(((minLat + maxLat) / 2) * (Math.PI / 180));
  const w = (maxLon - minLon) * k;
  const h = maxLat - minLat;
  const scale = Math.max(w, h) || 1;

  /*
    Normalised by the LONGER axis so both coordinates stay in 0..1 and the
    shape is never distorted. The caller then needs the real aspect ratio,
    or a wide network drawn into a square box floats in dead space — which
    is exactly how the first version looked.
  */
  return {
    toXY: (lat: number, lon: number) => ({
      x: ((lon - minLon) * k) / scale,
      // SVG y grows downward; north should be up.
      y: (maxLat - lat) / scale,
    }),
    aspect: h / (w || 1),
  };
}
