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
  /** The first departure of its service day in this direction. */
  firstOfDay: boolean;
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
  /**
   * Not running now: the next train is the first of a service day and more
   * than CLOSED_GAP_MIN away. True from the last train right through to the
   * morning, not only until midnight.
   */
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
// Under this, "first train in 20 min" reads better as a departure than as closed.
const CLOSED_GAP_MIN = 30;

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
    // A direction's first train per service day, across all its headsigns.
    const firstByDay = new Map<ServicePattern, number>();
    for (const { pattern } of days) {
      const times = (timetable.schedule[pattern] ?? [])
        .filter((e) => e.line === g.line && e.direction === g.direction)
        .flatMap((e) => e.departures);
      if (times.length) firstByDay.set(pattern, Math.min(...times));
    }

    for (const { pattern, offset } of days) {
      for (const entry of timetable.schedule[pattern] ?? []) {
        if (entry.line !== g.line || entry.direction !== g.direction) continue;
        const first = firstByDay.get(pattern);
        for (const t of entry.departures) {
          const delta = t + offset - minutes;
          if (delta < 0) continue;
          candidates.push({
            scheduled: t,
            inMinutes: delta,
            headsign: entry.headsign,
            // Anything that lands past today's midnight boundary.
            nextDay: t + offset >= 1440,
            firstOfDay: t === first,
          });
        }
      }
    }

    candidates.sort((a, b) => a.inMinutes - b.inMinutes);
    g.upcoming = candidates.slice(0, limit);
    /*
      Closed when the soonest train opens a service day and is a while off.
      Keying on "tomorrow" alone stopped at midnight: at 12:30am the 6am
      train belongs to the new calendar day, so the board went back to
      quoting it in big digits as though it were simply the next train.
    */
    const soonest = g.upcoming[0];
    // Nothing ahead at all (no trains tomorrow on this direction) is closed too.
    g.serviceEnded = soonest === undefined || (soonest.firstOfDay && soonest.inMinutes > CLOSED_GAP_MIN);
    if (g.firstTrain === Infinity) g.firstTrain = 0;
    if (g.lastTrain === -Infinity) g.lastTrain = 0;
    // Dedupe while preserving "most trains first" order.
    g.headsigns = [...new Set(g.headsigns)];
  }

  return [...groups.values()].sort(
    (a, b) => a.line.localeCompare(b.line) || a.direction.localeCompare(b.direction),
  );
}

/**
 * The trains still to come in the service that is running now: everything up
 * to the first train of the next service day. Calendar dates cannot draw this
 * line — at 12:05am tomorrow's 6:20 has the same date as now — so it is drawn
 * at the start of the next service instead.
 */
export function thisService(upcoming: UpcomingDeparture[]): UpcomingDeparture[] {
  const nextStart = upcoming.findIndex((u, i) => i > 0 && u.firstOfDay);
  return nextStart === -1 ? upcoming : upcoming.slice(0, nextStart);
}

export interface LeaveNow {
  /** Minutes until you should set off; 0 means go now. */
  leaveIn: number;
  train: UpcomingDeparture;
  group: DirectionGroup;
}

/**
 * The first train you can still walk to, and when to set off for it.
 *
 * Only trains in the service running now count — including the runs just
 * past midnight — because telling someone to leave in six hours for the
 * morning's first train is not advice. Groups need a deep enough `upcoming`
 * list (call nextDepartures with a larger limit) for a long walk to find one.
 */
export function leaveNow(groups: DirectionGroup[], walkMinutes: number): LeaveNow | null {
  let best: LeaveNow | null = null;
  for (const group of groups) {
    if (group.serviceEnded) continue;
    const train = thisService(group.upcoming).find((u) => u.inMinutes >= walkMinutes);
    if (!train) continue;
    if (!best || train.inMinutes < best.train.inMinutes) {
      best = { leaveIn: train.inMinutes - walkMinutes, train, group };
    }
  }
  return best;
}

/** Every direction is closed; the earliest first train, i.e. when service resumes. */
export function serviceResumes(groups: DirectionGroup[]): UpcomingDeparture | null {
  if (groups.length === 0 || !groups.every((g) => g.serviceEnded)) return null;
  return groups
    .map((g) => g.upcoming[0])
    .filter((u): u is UpcomingDeparture => u !== undefined)
    .sort((a, b) => a.inMinutes - b.inMinutes)[0] ?? null;
}
