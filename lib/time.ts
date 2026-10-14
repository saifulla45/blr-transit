/**
 * The ONLY module that touches `Date`.
 *
 * Everything downstream works in integer minutes so that no time string is ever
 * parsed at runtime — `new Date("2026-09-29 05:00")` is `Invalid Date` in Safari
 * while working in Chrome, and that class of bug is easiest to remove by
 * construction rather than by testing for it.
 */
import type { CalendarOverrides, ServicePattern } from '@/types/transit';

export const TZ = 'Asia/Kolkata';

export interface Now {
  /** Local date in Bengaluru as "YYYY-MM-DD". */
  date: string;
  /** Minutes since local midnight, 0..1439. */
  minutes: number;
  /** 0 = Sunday .. 6 = Saturday, in Bengaluru. */
  weekday: number;
}

/**
 * Reads the wall clock in Bengaluru regardless of the device's own timezone,
 * so a phone still set to Dubai time shows correct Bengaluru departures.
 */
export function nowInBengaluru(at: Date = new Date()): Now {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
    weekday: 'short',
    hour12: false,
  }).formatToParts(at);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  // Intl can emit "24" for midnight under hour12:false; normalise to 0.
  const hour = Number(get('hour')) % 24;

  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    minutes: hour * 60 + Number(get('minute')),
    weekday: weekdays.indexOf(get('weekday')),
  };
}

/** The previous calendar day, as "YYYY-MM-DD". Pure string/UTC math. */
export function previousDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - 1);
  return dt.toISOString().slice(0, 10);
}

/** The next calendar day, as "YYYY-MM-DD". */
export function nextDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + 1);
  return dt.toISOString().slice(0, 10);
}

export function weekdayOf(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/**
 * Which timetable applies on a given Bengaluru date.
 *
 * calendar_dates.txt is checked first and matters a lot: BMRCL runs the holiday
 * timetable on 2nd and 4th Saturdays as well as public holidays, roughly 40 days
 * a year that a plain day-of-week lookup would get wrong.
 */
export function servicePatternFor(
  date: string,
  overrides: CalendarOverrides,
  weekday = weekdayOf(date),
): ServicePattern {
  const override = overrides[date];
  if (override) return override;
  if (weekday === 0) return 'sunday';
  if (weekday === 1) return 'monday';
  return 'weekday';   // BMRCL's "weekday" service runs Tue-Sat.
}

/**
 * Splits minutes-since-midnight into 12-hour parts.
 *
 * Returned separately so the UI can set the meridiem smaller than the numerals
 * — on the departure board the time is the largest thing on the page and
 * "am"/"pm" at that size would dominate it.
 */
export function clockParts(minutes: number): { time: string; meridiem: 'am' | 'pm' } {
  const m = ((minutes % 1440) + 1440) % 1440;
  const h24 = Math.floor(m / 60);
  const meridiem = h24 < 12 ? 'am' : 'pm';
  // 0 -> 12am, 12 -> 12pm, 13 -> 1pm.
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return { time: `${h12}:${String(m % 60).padStart(2, '0')}`, meridiem };
}

/** Formats minutes-since-midnight as "6:42 pm", wrapping past-midnight values. */
export function formatMinutes(minutes: number): string {
  const { time, meridiem } = clockParts(minutes);
  return `${time} ${meridiem}`;
}

/** "in 4 min" / "in 1 h 12 min", for a relative hint beside the scheduled time. */
export function formatRelative(deltaMinutes: number): string {
  if (deltaMinutes <= 0) return 'due';
  if (deltaMinutes < 60) return `in ${deltaMinutes} min`;
  const h = Math.floor(deltaMinutes / 60);
  const m = deltaMinutes % 60;
  return m === 0 ? `in ${h} h` : `in ${h} h ${m} min`;
}
