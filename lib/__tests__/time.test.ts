import { describe, it, expect } from 'vitest';
import {
  clockParts, formatMinutes, formatRelative, nextDate, nowInBengaluru,
  previousDate, servicePatternFor, weekdayOf,
} from '../time';
import type { CalendarOverrides } from '@/types/transit';

describe('nowInBengaluru', () => {
  // These assertions must hold no matter what TZ the test process runs under,
  // which is the whole point of the module. See package.json test:tz.
  it('reads Bengaluru wall-clock from a UTC instant', () => {
    // 2026-09-29T12:00:00Z -> 17:30 IST (UTC+5:30)
    const n = nowInBengaluru(new Date('2026-09-29T12:00:00Z'));
    expect(n.date).toBe('2026-09-29');
    expect(n.minutes).toBe(17 * 60 + 30);
    expect(n.weekday).toBe(2); // Tuesday
  });

  it('rolls the Bengaluru date forward before UTC midnight', () => {
    // 22:00Z on the 29th is already 03:30 on the 30th in Bengaluru.
    const n = nowInBengaluru(new Date('2026-09-29T22:00:00Z'));
    expect(n.date).toBe('2026-09-30');
    expect(n.minutes).toBe(3 * 60 + 30);
  });

  it('represents Bengaluru midnight as 0, not 1440', () => {
    // 18:30Z == 00:00 IST the next day.
    const n = nowInBengaluru(new Date('2026-09-29T18:30:00Z'));
    expect(n.minutes).toBe(0);
    expect(n.date).toBe('2026-09-30');
  });
});

describe('date helpers', () => {
  it('steps across month and year boundaries', () => {
    expect(previousDate('2026-03-01')).toBe('2026-02-28');
    expect(nextDate('2026-12-31')).toBe('2027-01-01');
    expect(previousDate('2028-03-01')).toBe('2028-02-29'); // leap year
  });

  it('computes weekday without local-timezone drift', () => {
    expect(weekdayOf('2026-09-27')).toBe(0); // Sunday
    expect(weekdayOf('2026-09-28')).toBe(1); // Monday
    expect(weekdayOf('2026-09-29')).toBe(2); // Tuesday
  });
});

describe('servicePatternFor', () => {
  const overrides: CalendarOverrides = {
    '2026-09-26': 'holiday', // 4th Saturday
    '2026-10-02': 'holiday', // Gandhi Jayanti, a Friday
  };

  it('maps plain days to BMRCL patterns', () => {
    expect(servicePatternFor('2026-09-27', overrides)).toBe('sunday');
    expect(servicePatternFor('2026-09-28', overrides)).toBe('monday');
    expect(servicePatternFor('2026-09-29', overrides)).toBe('weekday');
  });

  it("treats an ordinary Saturday as BMRCL's weekday service", () => {
    // BMRCL's 'weekday' runs Tue-Sat; there is no separate Saturday pattern.
    expect(servicePatternFor('2026-09-19', overrides)).toBe('weekday');
  });

  it('applies calendar_dates overrides on 2nd/4th Saturdays', () => {
    expect(servicePatternFor('2026-09-26', overrides)).toBe('holiday');
  });

  it('applies overrides on public holidays that fall midweek', () => {
    expect(servicePatternFor('2026-10-02', overrides)).toBe('holiday');
  });
});

describe('formatting', () => {
  it('formats a 12-hour clock with meridiem', () => {
    expect(formatMinutes(0)).toBe('12:00 am');          // midnight is 12am, not 0
    expect(formatMinutes(5 * 60 + 30)).toBe('5:30 am');
    expect(formatMinutes(12 * 60)).toBe('12:00 pm');     // noon is 12pm, not 0
    expect(formatMinutes(13 * 60 + 5)).toBe('1:05 pm');
    expect(formatMinutes(23 * 60 + 59)).toBe('11:59 pm');
  });

  it('wraps past-midnight service into the next day', () => {
    expect(formatMinutes(1455)).toBe('12:15 am');        // 24:15
    expect(formatMinutes(1466)).toBe('12:26 am');        // 24:26, the real last train
  });

  it('splits the clock so the meridiem can be styled apart', () => {
    expect(clockParts(13 * 60 + 5)).toEqual({ time: '1:05', meridiem: 'pm' });
    expect(clockParts(0)).toEqual({ time: '12:00', meridiem: 'am' });
    expect(clockParts(12 * 60)).toEqual({ time: '12:00', meridiem: 'pm' });
  });

  it('formats relative times', () => {
    expect(formatRelative(0)).toBe('due');
    expect(formatRelative(4)).toBe('in 4 min');
    expect(formatRelative(72)).toBe('in 1 h 12 min');
    expect(formatRelative(120)).toBe('in 2 h');
  });
});
