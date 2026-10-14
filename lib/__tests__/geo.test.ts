import { describe, it, expect } from 'vitest';
import { formatDistance, haversineKm, nearestStations, walkingMinutes } from '../geo';
import type { Station } from '@/types/transit';

const station = (id: string, name: string, lat: number, lon: number): Station => ({
  id, name, lat, lon, lines: ['PURPLE'], isInterchange: false, wheelchair: true,
});

const STATIONS = [
  station('IDN', 'Indiranagar', 12.978406, 77.638566),
  station('MAGR', 'Mahatma Gandhi Road', 12.975727, 77.606201),
  station('KGWA', 'Majestic', 12.975526, 77.572867),
  station('WHTM', 'Whitefield', 12.995807, 77.758132),
];

describe('haversineKm', () => {
  it('is zero for the same point', () => {
    expect(haversineKm(12.97, 77.59, 12.97, 77.59)).toBe(0);
  });

  it('matches a known Bengaluru distance', () => {
    // Indiranagar -> MG Road is roughly 3.5 km as the crow flies.
    const d = haversineKm(12.978406, 77.638566, 12.975727, 77.606201);
    expect(d).toBeGreaterThan(3.2);
    expect(d).toBeLessThan(3.8);
  });

  it('is symmetric', () => {
    const a = haversineKm(12.97, 77.59, 13.01, 77.64);
    const b = haversineKm(13.01, 77.64, 12.97, 77.59);
    expect(a).toBeCloseTo(b, 10);
  });
});

describe('nearestStations', () => {
  it('finds the closest station to a point in Indiranagar', () => {
    const [first] = nearestStations(12.9784, 77.6386, STATIONS, 3);
    expect(first.item.id).toBe('IDN');
    expect(first.distanceKm).toBeLessThan(0.1);
  });

  it('returns results sorted by distance and capped at n', () => {
    const r = nearestStations(12.9784, 77.6386, STATIONS, 2);
    expect(r).toHaveLength(2);
    expect(r[0].distanceKm).toBeLessThanOrEqual(r[1].distanceKm);
  });

  it('handles n larger than the station list', () => {
    expect(nearestStations(12.97, 77.59, STATIONS, 99)).toHaveLength(4);
  });
});

describe('formatting', () => {
  it('uses metres below 1 km and km above', () => {
    expect(formatDistance(0.42)).toBe('420 m');
    expect(formatDistance(3.456)).toBe('3.5 km');
  });

  it('never reports a zero-minute walk', () => {
    expect(walkingMinutes(0)).toBe(1);
    expect(walkingMinutes(1)).toBeGreaterThan(10);
  });
});
