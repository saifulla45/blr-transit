import { describe, expect, it } from 'vitest';
import { lastTrainToward } from '../lastTrain';
import type { DirectionGroup } from '../departures';
import type { Line } from '@/types/transit';

/*
  A two-line network crossing at X, which is the only shape where the old
  "latest train in any direction" answer went wrong:

    GREEN:  G1 - G2 - X - G3 - G4
    PURPLE: P1 - P2 - X - P3 - P4
*/
const LINES: Line[] = [
  { id: 'GREEN' as Line['id'], name: 'Green', color: '#009933', textColor: '#fff', order: ['G1', 'G2', 'X', 'G3', 'G4'] },
  { id: 'PURPLE' as Line['id'], name: 'Purple', color: '#8C2877', textColor: '#fff', order: ['P1', 'P2', 'X', 'P3', 'P4'] },
];

const NAMES: Record<string, string> = {
  G1: 'Gee One', G2: 'Gee Two', X: 'Cross', G3: 'Gee Three', G4: 'Gee Four',
  P1: 'Pee One', P2: 'Pee Two', P3: 'Pee Three', P4: 'Pee Four',
};
const nameById = (id: string) => NAMES[id];

function group(line: string, headsign: string, lastTrain: number): DirectionGroup {
  // DirectionId is a '0' | '1' string union in the feed, not a number.
  return {
    line: line as DirectionGroup['line'],
    direction: '0' as DirectionGroup['direction'],
    primaryHeadsign: headsign,
    headsigns: [headsign],
    upcoming: [],
    serviceEnded: false,
    firstTrain: 300,
    lastTrain,
  };
}

// Four directions from the interchange, each ending at a different hour.
const GROUPS = [
  group('GREEN', 'Gee Four', 1417),   // 23:37 — the old answer, always
  group('GREEN', 'Gee One', 1415),
  group('PURPLE', 'Pee Four', 1400),
  group('PURPLE', 'Pee One', 1399),   // 23:19
];

describe('lastTrainToward', () => {
  it('picks the direction that actually serves the destination', () => {
    // Towards G4: forward along Green.
    expect(lastTrainToward(['X', 'G3', 'G4'], 0, GROUPS, LINES, nameById)?.minutes).toBe(1417);
    // Towards G1: backward along Green — a different, earlier train.
    expect(lastTrainToward(['X', 'G2', 'G1'], 0, GROUPS, LINES, nameById)?.minutes).toBe(1415);
    // Towards P1: backward along Purple, earliest of the four.
    expect(lastTrainToward(['X', 'P2', 'P1'], 0, GROUPS, LINES, nameById)?.minutes).toBe(1399);
  });

  it('does not just return the latest train, which was the old bug', () => {
    const latestAnywhere = Math.max(...GROUPS.map((g) => g.lastTrain));
    const towardsP1 = lastTrainToward(['X', 'P2', 'P1'], 0, GROUPS, LINES, nameById)!;
    expect(towardsP1.minutes).toBeLessThan(latestAnywhere);
    // 18 minutes of false reassurance, which is a missed last train.
    expect(latestAnywhere - towardsP1.minutes).toBe(18);
  });

  it('identifies the line you board, not merely a line you are standing on', () => {
    // X sits on both lines; the next stop decides which one you get on.
    expect(lastTrainToward(['X', 'G3', 'G4'], 0, GROUPS, LINES, nameById)?.line).toBe('GREEN');
    expect(lastTrainToward(['X', 'P3', 'P4'], 0, GROUPS, LINES, nameById)?.line).toBe('PURPLE');
  });

  it('flags a route that needs a change, because the connection is unverified', () => {
    expect(lastTrainToward(['X', 'G3'], 0, GROUPS, LINES, nameById)?.viaInterchange).toBe(false);
    expect(lastTrainToward(['G1', 'G2', 'X', 'P3'], 1, GROUPS, LINES, nameById)?.viaInterchange).toBe(true);
  });

  it('resolves headsigns by station NAME, not id', () => {
    // The ids are G1..P4 and the headsigns are "Gee One".."Pee Four". If the
    // two were compared directly nothing would ever match and every lookup
    // would fall through to the single-candidate branch.
    const onlyGreen = GROUPS.filter((g) => g.line === 'GREEN');
    expect(lastTrainToward(['X', 'G3', 'G4'], 0, onlyGreen, LINES, nameById)?.headsign).toBe('Gee Four');
  });

  it('still answers at a terminus, where only one direction exists', () => {
    const fromTerminus = [group('GREEN', 'Gee Four', 1417)];
    expect(lastTrainToward(['G1', 'G2'], 0, fromTerminus, LINES, nameById)?.minutes).toBe(1417);
  });

  it('returns null rather than guessing when it cannot tell', () => {
    expect(lastTrainToward([], 0, GROUPS, LINES, nameById)).toBeNull();
    expect(lastTrainToward(['X'], 0, GROUPS, LINES, nameById)).toBeNull();
    expect(lastTrainToward(['X', 'G3'], 0, [], LINES, nameById)).toBeNull();
    // A path whose hop is not on any single line.
    expect(lastTrainToward(['G1', 'P4'], 0, GROUPS, LINES, nameById)).toBeNull();
  });
});
