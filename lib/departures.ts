/**
 * Pure departure logic. No I/O, no `Date`, no time-string parsing — callers pass
 * "minutes since midnight" in from lib/time.
 */
import type {
  CalendarOverrides, DirectionId, LineId, ServicePattern, StationTimetable,
} from '@/types/transit';
import { nextDate, previousDate, servicePatternFor } from './time';

export interface UpcomingDeparture {
  /** Scheduled time as minutes since midnight of its own service day. */
  scheduled: number;
  /** Minutes from "now" until this train departs. */
  inMinutes: number;
  headsign: string;
  /** True when the train runs after midnight tonight, or is tomorrow's first. */
  nextDay: boolean;
}

export interface DirectionGroup {
  line: LineId;
  direction: DirectionId;
  /** Platform this direction departs from, when the feed names one. */
  platform?: string;
  /** The destination most trains on this direction serve. */
  primaryHeadsign: string;
  /** All destinations served, so short-loops are visible. */
  headsigns: string[];
  upcoming: UpcomingDeparture[];
  /** No more trains today; `upcoming` holds tomorrow's first instead. */
  serviceEnded: boolean;
  firstTrain: number;
  lastTrain: number;
}

export interface DeparturesInput {
  timetable: StationTimetable;
  overrides: CalendarOverrides;
  /** Bengaluru local date, "YYYY-MM-DD". */
  date: string;
  /** Bengaluru local time, minutes since midnight. */
  minutes: number;
  /** How many upcoming trains to return per direction. */
  limit?: number;
}

/**
 * Next departures per (line, direction), merging destinations so a rider sees a
 * single chronological list and can tell a short-loop from a full run.
 */
export function nextDepartures(input: DeparturesInput): DirectionGroup[] {
  const { timetable, overrides, date, minutes, limit = 4 } = input;

  // A train at 24:15 belongs to the previous service day, so yesterday's
  // timetable is part of "what is running right now" just after midnight.
  const days: Array<{ pattern: ServicePattern; offset: number }> = [
    { pattern: servicePatternFor(previousDate(date), overrides), offset: -1440 },
    { pattern: servicePatternFor(date, overrides), offset: 0 },
    { pattern: servicePatternFor(nextDate(date), overrides), offset: 1440 },
  ];

  // Collect every (line, direction) this station serves on the current day.
  const groups = new Map<string, DirectionGroup>();
  const today = timetable.schedule[days[1].pattern] ?? [];
  for (const entry of today) {
    const key = `${entry.line}:${entry.direction}`;
    let g = groups.get(key);
    if (!g) {
      g = {
        line: entry.line,
        direction: entry.direction,
        ...(entry.platform ? { platform: entry.platform } : {}),
        primaryHeadsign: entry.headsign,
        headsigns: [],
        upcoming: [],
        serviceEnded: false,
        firstTrain: Infinity,
        lastTrain: -Infinity,
      };
      groups.set(key, g);
    }
    g.headsigns.push(entry.headsign);
    if (entry.departures.length) {
      g.firstTrain = Math.min(g.firstTrain, entry.departures[0]);
      g.lastTrain = Math.max(g.lastTrain, entry.departures[entry.departures.length - 1]);
    }
    // The destination with the most trains is the one worth leading with.
    const currentPrimary = today
      .filter((e) => e.line === entry.line && e.direction === entry.direction)
      .reduce((a, b) => (b.departures.length > a.departures.length ? b : a));
    g.primaryHeadsign = currentPrimary.headsign;
  }

  for (const g of groups.values()) {
    const candidates: UpcomingDeparture[] = [];

    for (const { pattern, offset } of days) {
      for (const entry of timetable.schedule[pattern] ?? []) {
        if (entry.line !== g.line || entry.direction !== g.direction) continue;
        for (const t of entry.departures) {
          const delta = t + offset - minutes;
          if (delta < 0) continue;
          candidates.push({
            scheduled: t,
            inMinutes: delta,
            headsign: entry.headsign,
            // Anything that lands past today's midnight boundary.
            nextDay: t + offset >= 1440,
          });
        }
      }
    }

    candidates.sort((a, b) => a.inMinutes - b.inMinutes);
    g.upcoming = candidates.slice(0, limit);
    // If the soonest train is tomorrow's, today's service is done.
    g.serviceEnded = g.upcoming.length > 0 && g.upcoming[0].nextDay
      && g.upcoming[0].scheduled + 1440 - minutes === g.upcoming[0].inMinutes;
    if (g.firstTrain === Infinity) g.firstTrain = 0;
    if (g.lastTrain === -Infinity) g.lastTrain = 0;
    // Dedupe while preserving "most trains first" order.
    g.headsigns = [...new Set(g.headsigns)];
  }

  return [...groups.values()].sort(
    (a, b) => a.line.localeCompare(b.line) || a.direction.localeCompare(b.direction),
  );
}
