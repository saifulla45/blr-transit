import { describe, expect, it } from 'vitest';
import { countRunning, project, trainsOnLine, type LiveLine } from '../livePositions';

/** Four stations, 10 minutes end to end, one train every 10 minutes. */
const LINE: LiveLine = {
  id: 'TEST',
  name: 'Test',
  stations: [
    { id: 'A', name: 'A', lat: 13.0, lon: 77.0 },
    { id: 'B', name: 'B', lat: 13.0, lon: 77.1 },
    { id: 'C', name: 'C', lat: 13.0, lon: 77.2 },
    { id: 'D', name: 'D', lat: 13.0, lon: 77.3 },
  ],
  offsets: [0, 3, 7, 10],
  runs: { weekday: { '0': [600, 610, 620], '1': [600, 610] } },
};

describe('trainsOnLine', () => {
  it('places a train partway between the stations it is between', () => {
    // Departed A at 600; at 605 it is 5 minutes in, between B (3) and C (7).
    const t = trainsOnLine(LINE, 'weekday', 605).find((x) => x.direction === '0')!;
    expect(t.from).toBe(1);
    expect(t.to).toBe(2);
    expect(t.t).toBeCloseTo((5 - 3) / (7 - 3), 5);
  });

  it('runs direction 1 backwards along the same offsets', () => {
    // Departed D at 600; at 605 it has 5 minutes behind it, so it sits at
    // offset 10-5=5 — the same physical place, travelling the other way.
    const t = trainsOnLine(LINE, 'weekday', 605).find((x) => x.direction === '1')!;
    expect(t.from).toBe(1);
    expect(t.to).toBe(2);
    expect(t.t).toBeCloseTo((5 - 3) / (7 - 3), 5);
  });

  it('drops trains that have not left or have already arrived', () => {
    expect(trainsOnLine(LINE, 'weekday', 599)).toHaveLength(0);
    // Last departure 620 + 10 minutes of running.
    expect(trainsOnLine(LINE, 'weekday', 631)).toHaveLength(0);
  });

  it('keeps a train that departed before midnight still running after it', () => {
    const late: LiveLine = { ...LINE, runs: { weekday: { '0': [1435], '1': [] } } };
    // 00:02 is minute 2; the train left at 23:55 and is 7 minutes in.
    const t = trainsOnLine(late, 'weekday', 2);
    expect(t).toHaveLength(1);
    expect(t[0].from).toBe(1);
  });

  it('returns nothing for a pattern the line does not run', () => {
    expect(trainsOnLine(LINE, 'holiday', 605)).toHaveLength(0);
  });

  it('survives a zero-length hop without dividing by zero', () => {
    const squashed: LiveLine = { ...LINE, offsets: [0, 3, 3, 10] };
    for (const t of trainsOnLine(squashed, 'weekday', 603)) {
      expect(Number.isFinite(t.t)).toBe(true);
    }
  });

  it('counts every running train across the network', () => {
    expect(countRunning({ lines: [LINE, LINE] }, 'weekday', 605))
      .toBe(trainsOnLine(LINE, 'weekday', 605).length * 2);
  });
});

describe('project', () => {
  const p = project(LINE.stations);

  it('puts north at the top', () => {
    const north = p.toXY(13.5, 77.0);
    const south = p.toXY(12.5, 77.0);
    expect(north.y).toBeLessThan(south.y);
  });

  it('keeps coordinates inside the unit box', () => {
    for (const s of LINE.stations) {
      const { x, y } = p.toXY(s.lat, s.lon);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(1);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(1);
    }
  });

  it('reports the aspect ratio so a wide network is not boxed into a square', () => {
    // These stations are a horizontal line, so height/width is ~0.
    expect(p.aspect).toBeLessThan(0.05);
    // Taller than wide, but not zero-width: a degenerate zero-width network
    // hits the divide-by-zero guard and is clamped by the caller anyway.
    const tall = project([
      { lat: 12.8, lon: 77.00 }, { lat: 13.2, lon: 77.05 },
    ]);
    expect(tall.aspect).toBeGreaterThan(1);
  });

  it('corrects for longitude convergence rather than stretching east-west', () => {
    // One degree of longitude is shorter than one of latitude at 13N, so a
    // square in degrees must not come out square in pixels.
    const square = project([
      { lat: 13.0, lon: 77.0 }, { lat: 14.0, lon: 78.0 },
    ]);
    expect(square.aspect).toBeGreaterThan(1);
  });
});
