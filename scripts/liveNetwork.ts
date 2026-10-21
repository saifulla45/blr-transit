import type {
  JourneyMatrix, Line, ServicePattern, Station, StationTimetable,
} from '../types/transit';

/**
 * Everything needed to draw where the trains are, right now.
 *
 * The home page has no timetables — those are per-station files fetched only
 * when you open a station — so a live view would otherwise need six separate
 * fetches just to find the termini. This bakes the whole thing into one small
 * file instead.
 *
 * The trick that keeps it small: a train is fully described by the time it
 * left its terminus. Given the cumulative travel time to each station down
 * the line, its position at any later moment is arithmetic. So instead of
 * shipping positions, ship one departure list per line and direction plus one
 * offsets array per line — a few thousand integers for the entire network.
 *
 * Scheduled positions, never live ones. BMRCL publishes no realtime feed, so
 * this is where a train is *meant* to be, and the UI has to say so.
 */

export interface LiveLine {
  id: string;
  name: string;
  /** Stations in running order, with coordinates for drawing. */
  stations: Array<{ id: string; name: string; lat: number; lon: number }>;
  /** Cumulative minutes from stations[0] to each station. */
  offsets: number[];
  /**
   * Departure times from each terminus, by service pattern.
   * "0" leaves stations[0]; "1" leaves the last station, running backwards.
   */
  runs: Record<string, { '0': number[]; '1': number[] }>;
}

export interface LiveNetwork {
  lines: LiveLine[];
}

export function buildLiveNetwork(
  lines: Line[],
  stations: Station[],
  journeys: JourneyMatrix,
  timetables: Map<string, StationTimetable>,
  patterns: readonly ServicePattern[],
): LiveNetwork {
  const byId = new Map(stations.map((s) => [s.id, s]));

  return {
    lines: lines.map((line) => {
      const order = line.order.filter((id) => byId.has(id));

      /*
        Cumulative travel time, summed from adjacent pairs in the journey
        matrix. Adjacent hops are the one case where that matrix is simply
        the scheduled run time with no interchange penalty mixed in.
      */
      const offsets: number[] = [0];
      for (let i = 1; i < order.length; i += 1) {
        const hop = journeys[order[i - 1]]?.[order[i]]?.[0] ?? 2;
        offsets.push(offsets[i - 1] + hop);
      }

      const runs: LiveLine['runs'] = {};
      for (const pattern of patterns) {
        runs[pattern] = {
          '0': terminusDepartures(timetables.get(order[0]), pattern, line.id),
          '1': terminusDepartures(timetables.get(order[order.length - 1]), pattern, line.id),
        };
      }

      return {
        id: line.id,
        name: line.name,
        stations: order.map((id) => {
          const s = byId.get(id)!;
          return { id: s.id, name: s.name, lat: s.lat, lon: s.lon };
        }),
        offsets,
        runs,
      };
    }),
  };
}

/**
 * A terminus has exactly one boardable direction per line — you can only
 * leave it one way — so there is no direction matching to do here. Where a
 * line runs short-loop services the terminus can still list more than one
 * entry; the busiest is the through service.
 */
function terminusDepartures(
  timetable: StationTimetable | undefined,
  pattern: ServicePattern,
  lineId: string,
): number[] {
  const entries = (timetable?.schedule?.[pattern] ?? []).filter((d) => d.line === lineId);
  if (entries.length === 0) return [];
  const best = entries.reduce((a, b) => (a.departures.length >= b.departures.length ? a : b));
  return best.departures;
}
