import { describe, it, expect } from 'vitest';
import { nextDepartures } from '../departures';
import type { CalendarOverrides, StationTimetable } from '@/types/transit';

const h = (hh: number, mm = 0) => hh * 60 + mm;

/** A small station: one line, both directions, plus a Purple short-loop. */
const timetable: StationTimetable = {
  id: 'TEST',
  name: 'Test Station',
  schedule: {
    weekday: [
      { line: 'PURPLE', direction: '0', headsign: 'Challaghatta',
        departures: [h(5, 30), h(6), h(18), h(18, 15), h(23, 30), h(24, 15)] },
      { line: 'PURPLE', direction: '1', headsign: 'Whitefield (Kadugodi)',
        departures: [h(5, 45), h(18, 5), h(23, 45)] },
      { line: 'PURPLE', direction: '1', headsign: 'Baiyappanahalli',
        departures: [h(18, 10)] },
    ],
    monday: [
      { line: 'PURPLE', direction: '0', headsign: 'Challaghatta', departures: [h(4, 45), h(18)] },
      { line: 'PURPLE', direction: '1', headsign: 'Whitefield (Kadugodi)', departures: [h(4, 50)] },
    ],
    sunday: [
      { line: 'PURPLE', direction: '0', headsign: 'Challaghatta', departures: [h(7, 30), h(18)] },
      { line: 'PURPLE', direction: '1', headsign: 'Whitefield (Kadugodi)', departures: [h(7, 35)] },
    ],
    holiday: [
      { line: 'PURPLE', direction: '0', headsign: 'Challaghatta', departures: [h(6), h(18)] },
      { line: 'PURPLE', direction: '1', headsign: 'Whitefield (Kadugodi)', departures: [h(6, 5)] },
    ],
  },
};

const overrides: CalendarOverrides = { '2026-09-26': 'holiday' };
// 2026-09-29 is a Tuesday -> weekday service.
const TUESDAY = '2026-09-29';

describe('nextDepartures', () => {
  it('returns the next trains in each direction during the day', () => {
    const groups = nextDepartures({ timetable, overrides, date: TUESDAY, minutes: h(17, 55) });
    const dir0 = groups.find((g) => g.direction === '0')!;
    expect(dir0.upcoming[0].scheduled).toBe(h(18));
    expect(dir0.upcoming[0].inMinutes).toBe(5);
    expect(dir0.serviceEnded).toBe(false);
  });

  it('merges short-loop destinations into one chronological list', () => {
    const groups = nextDepartures({ timetable, overrides, date: TUESDAY, minutes: h(18) });
    const dir1 = groups.find((g) => g.direction === '1')!;
    // 18:05 to Whitefield, then the 18:10 short-loop to Baiyappanahalli,
    // then 23:45, then (limit is 4) tomorrow's 05:45.
    expect(dir1.upcoming.map((u) => [u.scheduled, u.headsign])).toEqual([
      [h(18, 5), 'Whitefield (Kadugodi)'],
      [h(18, 10), 'Baiyappanahalli'],
      [h(23, 45), 'Whitefield (Kadugodi)'],
      [h(5, 45), 'Whitefield (Kadugodi)'],
    ]);
    expect(dir1.upcoming[3].nextDay).toBe(true);
    expect(dir1.primaryHeadsign).toBe('Whitefield (Kadugodi)');
    expect(dir1.headsigns).toContain('Baiyappanahalli');
  });

  it('shows the first train of the day before service starts', () => {
    const groups = nextDepartures({ timetable, overrides, date: TUESDAY, minutes: h(4, 30) });
    const dir0 = groups.find((g) => g.direction === '0')!;
    expect(dir0.upcoming[0].scheduled).toBe(h(5, 30));
    expect(dir0.upcoming[0].inMinutes).toBe(60);
    expect(dir0.serviceEnded).toBe(false);
  });

  it("rolls to tomorrow's first train once service has ended", () => {
    // 23:50: the 23:30 and the 24:15 past-midnight run are the only ones left.
    const groups = nextDepartures({ timetable, overrides, date: TUESDAY, minutes: h(23, 50) });
    const dir1 = groups.find((g) => g.direction === '1')!;
    // Nothing left today on dir1 (last was 23:45), so tomorrow's 05:45.
    expect(dir1.serviceEnded).toBe(true);
    expect(dir1.upcoming[0].scheduled).toBe(h(5, 45));
    expect(dir1.upcoming[0].inMinutes).toBe(355); // 23:50 -> 05:45 next day
  });

  it('keeps past-midnight service attached to the correct service day', () => {
    // At 00:05 Wednesday, the 24:15 train from TUESDAY's timetable still runs.
    const groups = nextDepartures({
      timetable, overrides, date: '2026-09-30', minutes: h(0, 5),
    });
    const dir0 = groups.find((g) => g.direction === '0')!;
    expect(dir0.upcoming[0].scheduled).toBe(h(24, 15));
    expect(dir0.upcoming[0].inMinutes).toBe(10);
  });

  it('never returns a departure in the past', () => {
    for (const minutes of [0, h(6), h(12), h(18), h(23, 59)]) {
      const groups = nextDepartures({ timetable, overrides, date: TUESDAY, minutes });
      for (const g of groups) {
        for (const u of g.upcoming) expect(u.inMinutes).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('returns chronologically ordered departures', () => {
    const groups = nextDepartures({ timetable, overrides, date: TUESDAY, minutes: h(5) });
    for (const g of groups) {
      const times = g.upcoming.map((u) => u.inMinutes);
      expect([...times].sort((a, b) => a - b)).toEqual(times);
    }
  });

  it('uses Sunday service on a Sunday', () => {
    const groups = nextDepartures({ timetable, overrides, date: '2026-09-27', minutes: h(6) });
    const dir0 = groups.find((g) => g.direction === '0')!;
    expect(dir0.upcoming[0].scheduled).toBe(h(7, 30));
  });

  it('uses Monday service on a Monday', () => {
    const groups = nextDepartures({ timetable, overrides, date: '2026-09-28', minutes: h(4) });
    const dir0 = groups.find((g) => g.direction === '0')!;
    expect(dir0.upcoming[0].scheduled).toBe(h(4, 45));
  });

  it('honours a calendar_dates override on a 4th Saturday', () => {
    // 2026-09-26 is a Saturday, which would normally be 'weekday' service.
    const groups = nextDepartures({ timetable, overrides, date: '2026-09-26', minutes: h(5) });
    const dir0 = groups.find((g) => g.direction === '0')!;
    // Holiday service starts at 06:00, not the weekday 05:30.
    expect(dir0.upcoming[0].scheduled).toBe(h(6));
  });

  it('respects the limit', () => {
    const groups = nextDepartures({
      timetable, overrides, date: TUESDAY, minutes: h(5), limit: 2,
    });
    for (const g of groups) expect(g.upcoming.length).toBeLessThanOrEqual(2);
  });

  it('reports first and last train for the day', () => {
    const groups = nextDepartures({ timetable, overrides, date: TUESDAY, minutes: h(12) });
    const dir0 = groups.find((g) => g.direction === '0')!;
    expect(dir0.firstTrain).toBe(h(5, 30));
    expect(dir0.lastTrain).toBe(h(24, 15));
  });
});
