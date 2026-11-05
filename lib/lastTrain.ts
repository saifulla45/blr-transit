import type { DirectionGroup } from './departures';
import type { Line } from '@/types/transit';

/**
 * The last train that is actually going your way.
 *
 * "Can I still get home?" is the highest-anxiety question a metro answers,
 * and the page used to get it wrong in a quiet way: it showed
 * `Math.max(...groups.map(g => g.lastTrain))`, the latest train in ANY
 * direction from this station. Standing at an interchange that is two
 * different answers, and the reassuring one is usually the wrong one —
 * the last southbound train is no help if you live north.
 *
 * This picks the direction that leads to your destination and reports that
 * direction's last train.
 *
 * What it deliberately does NOT claim: that the whole journey is still
 * possible. On a route with a change of line, the binding constraint is
 * usually the SECOND leg, whose timetable is not loaded on this page — the
 * station page only ships its own. Proving the connection would need
 * time-expanded routing across every station's timetable at build time. So
 * the result is flagged `viaInterchange` and the UI says so, rather than
 * implying a guarantee it cannot make.
 */
export interface LastTrainToward {
  /** Minutes since midnight of the last departure heading that way. */
  minutes: number;
  /** The line you board. */
  line: string;
  /** Where that train terminates. */
  headsign: string;
  /** True when the route needs a change, so the connection is unverified. */
  viaInterchange: boolean;
}

/**
 * `path` is the journey's station sequence, origin first. `groups` are the
 * origin's departure groups. Returns null when the direction cannot be
 * identified, which is the honest outcome — better no figure than a
 * confident wrong one.
 */
export function lastTrainToward(
  path: string[],
  interchanges: number,
  groups: DirectionGroup[],
  lines: Line[],
  nameById: (id: string) => string | undefined,
): LastTrainToward | null {
  const chosen = groupToward(path, groups, lines, nameById);
  if (!chosen) return null;
  return {
    minutes: chosen.lastTrain,
    line: chosen.line,
    headsign: chosen.primaryHeadsign,
    viaInterchange: interchanges > 0,
  };
}

/**
 * The departure group at the origin that heads along `path`, or null when
 * the direction cannot be identified. Shared by the last-train line and
 * "catch the next train", which both have to mean the train going YOUR way.
 */
export function groupToward(
  path: string[],
  groups: DirectionGroup[],
  lines: Line[],
  /*
    Needed because `line.order` holds station IDS while `primaryHeadsign` is
    a station NAME. Matching one against the other directly always fails and
    then falls through to the single-candidate branch, which silently gives
    the right answer at termini and no answer anywhere else — a bug that
    looks like it works.
  */
  nameById: (id: string) => string | undefined,
): DirectionGroup | null {
  if (path.length < 2 || groups.length === 0) return null;

  const [originId, nextId] = path;

  // The line you board is the one carrying both the origin and the next stop.
  // At an interchange several lines serve the origin; only one also serves
  // the next station in the path.
  const boarding = lines.find(
    (l) => l.order.includes(originId) && l.order.includes(nextId),
  );
  if (!boarding) return null;

  const originIndex = boarding.order.indexOf(originId);
  const nextIndex = boarding.order.indexOf(nextId);
  // Which way along the line's running order you are travelling.
  const forward = nextIndex > originIndex;

  const candidates = groups.filter((g) => g.line === boarding.id);
  if (candidates.length === 0) return null;

  /*
    Match a direction by where its trains terminate rather than by the
    feed's direction_id, which is an arbitrary 0/1 with no guaranteed
    meaning. A terminus beyond this station in the running order means that
    direction is heading the same way the journey does.
  */
  const sameWay = candidates.filter((g) => {
    const terminusIndex = boarding.order.findIndex(
      (id, i) => i !== originIndex && normalise(nameById(id) ?? '') === normalise(g.primaryHeadsign),
    );
    if (terminusIndex === -1) return false;
    return forward ? terminusIndex > originIndex : terminusIndex < originIndex;
  });

  // Fall back to a single remaining candidate: a terminus station has only
  // one direction, and its headsign may not resolve to a station id.
  return sameWay.length > 0
    ? sameWay.reduce((a, b) => (a.lastTrain >= b.lastTrain ? a : b))
    : candidates.length === 1 ? candidates[0]
    : null;
}

function normalise(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}
