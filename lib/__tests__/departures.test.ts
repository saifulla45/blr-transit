import { describe, it, expect } from 'vitest';
import { leaveNow, nextDepartures, serviceResumes, thisService } from '../departures';
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

  it('shows the first train of the day before service starts, and calls it closed', () => {
    const groups = nextDepartures({ timetable, overrides, date: TUESDAY, minutes: h(4, 30) });
    const dir0 = groups.find((g) => g.direction === '0')!;
    expect(dir0.upcoming[0].scheduled).toBe(h(5, 30));
    expect(dir0.upcoming[0].inMinutes).toBe(60);
    // An hour before the first train the metro is not running.
    expect(dir0.serviceEnded).toBe(true);
  });

  it('treats the first train as a departure once it is close', () => {
    const groups = nextDepartures({ timetable, overrides, date: TUESDAY, minutes: h(5, 10) });
    expect(groups.find((g) => g.direction === '0')!.serviceEnded).toBe(false);
  });

  it('stays closed after midnight, not only until it', () => {
    // 00:30 Wednesday: last night's 24:15 has gone, the next is 05:30.
    const groups = nextDepartures({ timetable, overrides, date: '2026-09-30', minutes: h(0, 30) });
    expect(groups.every((g) => g.serviceEnded)).toBe(true);
    expect(serviceResumes(groups)!.scheduled).toBe(h(5, 30));
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

describe('leaveNow', () => {
  it('picks the first train you can still walk to and when to set off', () => {
    // 17:55 with an 8 minute walk: the 18:00 is gone, the 18:05 is catchable.
    const groups = nextDepartures({ timetable, overrides, date: TUESDAY, minutes: h(17, 55), limit: 6 });
    const plan = leaveNow(groups, 8)!;
    expect(plan.train.scheduled).toBe(h(18, 5));
    expect(plan.leaveIn).toBe(2);
    expect(plan.group.direction).toBe('1');
  });

  it('says go now when the walk exactly fits', () => {
    const groups = nextDepartures({ timetable, overrides, date: TUESDAY, minutes: h(17, 55), limit: 6 });
    expect(leaveNow(groups, 5)!.leaveIn).toBe(0);
  });

  it("counts tonight's past-midnight run but never tomorrow's first train", () => {
    const late = nextDepartures({ timetable, overrides, date: TUESDAY, minutes: h(23, 50), limit: 6 });
    expect(leaveNow(late, 10)!.train.scheduled).toBe(h(24, 15));
    expect(leaveNow(late, 30)).toBeNull();
  });
});

describe('serviceResumes', () => {
  it('is null while any direction is still running', () => {
    const groups = nextDepartures({ timetable, overrides, date: TUESDAY, minutes: h(23, 50) });
    expect(serviceResumes(groups)).toBeNull();
  });

  it('gives the earliest first train once every direction has finished', () => {
    const early: StationTimetable = {
      id: 'EARLY', name: 'Early Close',
      schedule: {
        weekday: [
          { line: 'GREEN', direction: '0', headsign: 'Silk Institute', departures: [h(5, 10), h(22)] },
          { line: 'GREEN', direction: '1', headsign: 'Madavara', departures: [h(5), h(22, 10)] },
        ],
        monday: [], sunday: [], holiday: [],
      },
    };
    const groups = nextDepartures({ timetable: early, overrides, date: TUESDAY, minutes: h(23) });
    const first = serviceResumes(groups)!;
    expect(first.scheduled).toBe(h(5));
    expect(first.inMinutes).toBe(360);
  });
});

describe('thisService', () => {
  it("stops at the next service day's first train, even on the same calendar date", () => {
    // 00:05 Wednesday on dir0: last night's 24:15 is still to come, then 05:30.
    const groups = nextDepartures({ timetable, overrides, date: '2026-09-30', minutes: h(0, 5), limit: 6 });
    const dir0 = groups.find((g) => g.direction === '0')!;
    expect(thisService(dir0.upcoming).map((u) => u.scheduled)).toEqual([h(24, 15)]);
  });

  it('keeps the first train when it is what is running next', () => {
    const groups = nextDepartures({ timetable, overrides, date: TUESDAY, minutes: h(5, 20), limit: 3 });
    const dir0 = groups.find((g) => g.direction === '0')!;
    expect(thisService(dir0.upcoming)[0].scheduled).toBe(h(5, 30));
    expect(thisService(dir0.upcoming).length).toBe(3);
  });

  it('gives leaveNow nothing rather than the morning train after a missed last one', () => {
    const groups = nextDepartures({ timetable, overrides, date: '2026-09-30', minutes: h(0, 5), limit: 6 });
    // 10 min to the 24:15 is catchable; 30 min is not, and 05:30 must not be offered.
    expect(leaveNow(groups, 10)!.train.scheduled).toBe(h(24, 15));
    expect(leaveNow(groups, 30)).toBeNull();
  });
});
