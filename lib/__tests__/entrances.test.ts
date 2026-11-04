import { describe, expect, it } from 'vitest';
import type { Poi, Station } from '@/types/transit';
import { bearingDeg, compassPoint, describeExits, nearestExit } from '../entrances';

const station = {
  id: 'X', name: 'Test', lat: 12.97, lon: 77.59, lines: ['PURPLE'],
  entrances: [
    { id: 'X_A', name: 'Entrance A', lat: 12.9710, lon: 77.59, toPlatformSec: 60 },
    { id: 'X_B', name: 'Entrance B', lat: 12.97, lon: 77.5912, toPlatformSec: 60 },
    { id: 'X_E', name: 'Entrance', lat: 12.969, lon: 77.589, toPlatformSec: 60 },
  ],
} as unknown as Station;

const poi = (name: string, lat: number, lon: number): Poi =>
  ({ name, kind: 'Pharmacy', category: 'health', lat, lon, distance: 0 });

describe('bearings', () => {
  it('reads the four cardinal directions', () => {
    expect(compassPoint(bearingDeg(0, 0, 1, 0))).toBe('North');
    expect(compassPoint(bearingDeg(0, 0, 0, 1))).toBe('East');
    expect(compassPoint(bearingDeg(0, 0, -1, 0))).toBe('South');
    expect(compassPoint(bearingDeg(0, 0, 0, -1))).toBe('West');
  });
});

describe('describeExits', () => {
  const exits = describeExits(station, [
    poi('Near A Pharmacy', 12.9711, 77.5901),
    poi('Far Away Hospital', 12.98, 77.60),
  ]);

  it('gives each exit its side of the station', () => {
    expect(exits.map((e) => e.side)).toEqual(['North', 'East', 'South-west']);
  });

  it('names an unlettered entrance by its side instead of a bare "Entrance"', () => {
    expect(exits.map((e) => e.label)).toEqual(['Exit A', 'Exit B', 'South-west exit']);
  });

  it('only borrows a landmark that is genuinely beside the exit', () => {
    expect(exits[0].landmark?.name).toBe('Near A Pharmacy');
    expect(exits[1].landmark).toBeNull();
  });

  it('picks the exit nearest the rider', () => {
    expect(nearestExit(exits, 12.98, 77.59)?.exit.label).toBe('Exit A');
    expect(nearestExit(exits, 12.96, 77.58)?.exit.label).toBe('South-west exit');
  });
});
