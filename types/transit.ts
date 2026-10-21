// Shared data shapes between the build pipeline and the app.

/** The four service patterns BMRCL operates. */
export type ServicePattern = 'weekday' | 'monday' | 'sunday' | 'holiday';

/**
 * Note there is no 'saturday' pattern: BMRCL's 'weekday' service is Tue-Sat.
 * 2nd and 4th Saturdays fall back to 'holiday' via calendar_dates.txt.
 */

/** GTFS direction_id, kept as-is so trips map cleanly. */
export type DirectionId = '0' | '1';

export type LineId = 'PURPLE' | 'GREEN' | 'YELLOW';

export interface Line {
  id: LineId;
  name: string;
  color: string;
  textColor: string;
  /**
   * Station ids in running order along the line, so a station page can show
   * where it sits and link to its neighbours.
   */
  order: string[];
}

export interface StationEntrance {
  id: string;
  /** Just the entrance label, e.g. "Entrance A" — the station name is stripped. */
  name: string;
  lat: number;
  lon: number;
  /**
   * Seconds from this entrance through the fare gate to the platform, from
   * pathways.txt. Note the feed only models fare gates — it carries no stairs,
   * escalator or lift data, so step-free routing inside a station is not
   * possible from it.
   */
  toPlatformSec?: number;
}

/**
 * The subset of a station that client components actually need.
 *
 * The full Station carries entrances (235 of them, with coordinates), Kannada
 * names and parking — roughly 42 KB across the network. Passing that whole
 * array to each client component serialises a separate copy into the page for
 * every one of them. The pickers, journey paths and maps need none of it.
 */
export interface StationLite {
  id: string;
  name: string;
  /**
   * Kannada name from the feed. Carried in the lean projection because
   * BMRCL's own signage is bilingual, and the name you point at when asking
   * an auto driver is this one, not the transliteration.
   */
  nameKn?: string;
  lat: number;
  lon: number;
  lines: LineId[];
  isInterchange: boolean;
}

export function toLite(s: Station): StationLite {
  return {
    id: s.id,
    name: s.name,
    nameKn: s.nameKn,
    lat: s.lat,
    lon: s.lon,
    lines: s.lines,
    isInterchange: s.isInterchange,
  };
}

export interface Station {
  /** GTFS parent stop_id, e.g. "AGPP". Stable, used in URLs. */
  id: string;
  name: string;
  /** Kannada name from the feed's translations. BMRCL signage is bilingual. */
  nameKn?: string;
  /** Street-level entrances, so "which exit?" has an answer. */
  entrances?: StationEntrance[];
  lat: number;
  lon: number;
  lines: LineId[];
  isInterchange: boolean;
  /** true when GTFS marks the station step-free. */
  wheelchair: boolean;
  /** Present only for stations that appear on BMRCL's parking list. */
  parking?: StationParking;
}

export interface StationParking {
  twoWheeler: number;
  fourWheeler: number;
}

/**
 * Departure times as integer MINUTES SINCE MIDNIGHT, deliberately not strings.
 * `new Date("2026-09-29 05:00")` is Invalid Date in Safari, so we never parse
 * a time string at runtime. Values >= 1440 are past-midnight service.
 */
export type Minutes = number;

export interface DirectionInfo {
  line: LineId;
  direction: DirectionId;
  /** Platform this direction departs from, e.g. "2". */
  platform?: string;
  /** Where trains on this direction terminate, e.g. "Madavara". */
  headsign: string;
  departures: Minutes[];
}

export interface StationTimetable {
  id: string;
  name: string;
  /**
   * One entry per (line, direction) served. This is a list rather than a map
   * keyed by direction because interchanges like Majestic are served by two
   * lines that BOTH use direction_id 0 and 1 — keying on direction alone
   * silently merges Purple departures into the Green bucket.
   */
  schedule: Record<ServicePattern, DirectionInfo[]>;
}

export interface StationsIndex {
  /** Build identifier, used to bust the CDN cache on data refresh. */
  version: string;
  /** Source feed version from feed_info.txt (YYYYMMDD). */
  feedVersion: string;
  /** Upstream git commit the feed was taken from. */
  sourceCommit: string;
  generatedAt: string;
  lines: Line[];
  stations: Station[];
}

/**
 * Journey facts between stations: [minutes, trackKm, interchanges, stationPath].
 * A tuple rather than an object — this is 6,806 entries and the key names would
 * be most of the payload. The path includes both endpoints.
 */
export type JourneyMatrix = Record<string, Record<string, [number, number, number, string[]]>>;

/**
 * Fares per station pair: [base, smartCardPeak, smartCardOffPeak] in rupees.
 *
 * Token and QR are always the same price and do not vary by time, so one
 * "base" covers both. A smart card saves 5% at peak and 10% off-peak — which is
 * the whole reason this is worth showing.
 */
export type FareMatrix = Record<string, Record<string, [number, number, number]>>;

/** A peak or off-peak window within a service day, in minutes since midnight. */
export interface FareWindow { from: Minutes; to: Minutes; peak: boolean }

/**
 * Peak windows per service pattern. Sundays and holidays are off-peak all day,
 * which is worth telling people.
 */
export type FareWindows = Record<ServicePattern, FareWindow[]>;

/** An unlimited-travel pass. Not a per-journey fare — it has no leg rules. */
export interface TravelPass {
  id: string;
  name: string;
  days: number;
  amount: number;
}

/** A way to pay, with what this journey costs on it. */
export interface FareOption {
  media: 'token' | 'qr' | 'smartcard';
  label: string;
  amount: number;
  /** Set when a cheaper price exists at another time of day. */
  note?: string;
}

/**
 * Dates that override the normal day-of-week pattern, from calendar_dates.txt.
 * BMRCL runs the holiday timetable on 2nd/4th Saturdays and public holidays,
 * so this covers ~40 days a year that a naive weekday lookup would get wrong.
 * Keyed "YYYY-MM-DD" -> the pattern that actually applies.
 */
export type CalendarOverrides = Record<string, ServicePattern>;

/** Network-wide service span per pattern, for the live status on the home page. */
export interface NetworkStatus {
  patterns: Record<ServicePattern, { firstTrain: Minutes; lastTrain: Minutes; trips: number }>;
}

/** A BMTC route catchable near a metro station. */
export interface BusRoute {
  /** Route number as displayed on the bus, e.g. "201". */
  route: string;
  /** The route's two endpoints, e.g. "Domlur ⇔ Srinagar". */
  destinations: string;
  /** Closest bus stop near the metro station that this route serves. */
  stopName: string;
  stopDistance: number;
  trips: number;
  firstBus: Minutes;
  lastBus: Minutes;
  /** Average gap between buses across the service span, in minutes. */
  headway: number;
}

export type BusesByStation = Record<string, BusRoute[]>;

/**
 * The whole BMTC network, compact enough to fetch on demand: every stop that
 * some route serves, and every route's ordered stop path. "Which bus goes from
 * A to B" is then a scan for routes where A appears before B.
 */
export interface BusNetwork {
  stops: Record<string, { name: string; lat: number; lon: number }>;
  routes: Record<string, { name: string; long: string; stops: string[] }>;
}

/** One direct-bus option between two stops. */
export interface DirectBus {
  routeId: string;
  name: string;
  long: string;
  boardStopId: string;
  alightStopId: string;
  /** Number of stops between boarding and alighting. */
  stopCount: number;
  /** Ordered stop names from boarding to alighting. */
  path: string[];
}

export type PoiCategory =
  | 'health' | 'food' | 'shopping' | 'worship' | 'money' | 'transport' | 'essentials';

export interface Poi {
  name: string;
  /** Human label for the OSM tag, e.g. "Pharmacy". */
  kind: string;
  category: PoiCategory;
  lat: number;
  lon: number;
  /** Metres from the station, straight line. */
  distance: number;
}

export type PoisByStation = Record<string, Poi[]>;

export const PARKING_RATES = {
  /**
   * Flat city-wide BMRCL rates. These are policy, not computed data.
   * Re-verify against https://english.bmrc.co.in/parking/ when this date goes stale.
   */
  lastVerified: '2026-09-30',
  source: 'https://english.bmrc.co.in/parking/',
  twoWheeler: { firstFourHours: 15, perExtraHour: 5, dailyMax: 30 },
  fourWheeler: { firstFourHours: 30, perExtraHour: 10, dailyMax: 60 },
  cyclesFree: true,
  overnightAllowed: false,
} as const;
