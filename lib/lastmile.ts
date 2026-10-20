/**
 * Getting to the station when it is too far to walk.
 *
 * The honest core of this file: exactly one number here is a fact, and it is
 * the metered auto fare. Bangalore Urban RTA publishes it as a legal rate
 * card, so it can be computed to the rupee. Everything app-based — Rapido,
 * Uber, Ola, Namma Yatri — is demand-priced with no published rate card, and
 * is therefore modelled as a RANGE relative to the meter, never as a single
 * figure that would imply a precision nobody can deliver.
 *
 * What that looks like in practice: a 2 km Residency Road to Church Street
 * trip was quoted 96 rupees on Rapido auto in 2026 while the meter for the
 * same 2 km is 36. Short hops are dominated by app minimum fares, and the
 * same trip in rain can double. A single predicted number would be wrong far
 * more often than it was right, so the UI shows the meter as the anchor and
 * sends people to the app for the real quote.
 */

/**
 * Bangalore Urban District RTA auto rickshaw tariff.
 *
 * Revised from the 30 rupee base that had stood since November 2021; meters
 * had to be re-verified by 31 October 2025, so this is the live card.
 *
 * Treat as policy, not data: re-check the date below before trusting it, the
 * same way the parking rates are handled.
 */
export const AUTO_TARIFF = {
  baseRupees: 36,
  baseKm: 2,
  perKmRupees: 18,
  /** 10pm–5am is charged at one and a half times. */
  nightMultiplier: 1.5,
  nightFromHour: 22,
  nightToHour: 5,
  source: 'Bangalore Urban District RTA',
  lastVerified: '2026-10-20',
} as const;

/**
 * Crow-flies to road distance.
 *
 * Every distance in this app is Haversine, but fares are charged on road
 * distance, which is always longer. Without this correction every fare shown
 * would be biased low — the direction that makes people feel cheated at the
 * end of the ride. 1.35 is the usual planning figure for a gridded-but-
 * irregular city; Bengaluru's lake and rail crossings push it higher in
 * places, so this stays an estimate.
 */
export const ROAD_FACTOR = 1.35;

export function isNightTariff(hour: number): boolean {
  return hour >= AUTO_TARIFF.nightFromHour || hour < AUTO_TARIFF.nightToHour;
}

/**
 * The regulated fare a street auto should charge, to the rupee.
 *
 * `straightLineKm` is Haversine; the road correction is applied here so
 * callers cannot forget it.
 */
export function meteredAutoFare(straightLineKm: number, hour: number): number {
  const roadKm = straightLineKm * ROAD_FACTOR;
  const beyondBase = Math.max(0, roadKm - AUTO_TARIFF.baseKm);
  const fare = AUTO_TARIFF.baseRupees + beyondBase * AUTO_TARIFF.perKmRupees;
  const withNight = isNightTariff(hour) ? fare * AUTO_TARIFF.nightMultiplier : fare;
  return Math.round(withNight);
}

export type RideMode = 'auto-meter' | 'auto-app' | 'bike' | 'cab';

export interface RideOption {
  mode: RideMode;
  label: string;
  /** Low and high rupees. Equal values mean a fixed, regulated fare. */
  low: number;
  high: number;
  /** True only for the regulated meter fare. Drives "estimate" labelling. */
  exact: boolean;
  note?: string;
}

/**
 * Multipliers against the metered auto fare.
 *
 * Anchoring to the meter rather than inventing per-km rates for each app
 * keeps one source of truth and makes the night tariff and road correction
 * flow through all four modes automatically. The spreads are wide on purpose:
 * they are honest about demand pricing rather than falsely precise.
 */
const RELATIVE_TO_METER: Record<Exclude<RideMode, 'auto-meter'>, [number, number]> = {
  // Reported at 30-40% above the meter in normal conditions, far higher in
  // rain or peak. The top of this range is deliberately not the worst case.
  'auto-app': [1.3, 1.9],
  // Roughly half an auto; the cheapest motorised option when it is running.
  bike: [0.6, 0.85],
  cab: [1.9, 2.8],
};

/** App minimum fares put a floor under short trips that per-km maths misses. */
const APP_FLOOR: Record<Exclude<RideMode, 'auto-meter'>, number> = {
  'auto-app': 50,
  bike: 30,
  cab: 100,
};

/**
 * Ride options to cover the gap to the station, cheapest first.
 *
 * `hour` is the hour in Asia/Kolkata — callers must not pass a raw local
 * hour, or a traveller whose phone is still on another timezone gets the
 * night tariff applied at the wrong time of day.
 */
export function rideOptions(straightLineKm: number, hour: number): RideOption[] {
  const meter = meteredAutoFare(straightLineKm, hour);
  const night = isNightTariff(hour);

  const scaled = (mode: Exclude<RideMode, 'auto-meter'>): [number, number] => {
    const [lo, hi] = RELATIVE_TO_METER[mode];
    const floor = APP_FLOOR[mode];
    return [
      Math.max(floor, Math.round((meter * lo) / 5) * 5),
      Math.max(floor + 10, Math.round((meter * hi) / 5) * 5),
    ];
  };

  const [bikeLo, bikeHi] = scaled('bike');
  const [autoLo, autoHi] = scaled('auto-app');
  const [cabLo, cabHi] = scaled('cab');

  return [
    {
      mode: 'bike',
      label: 'Bike taxi',
      low: bikeLo,
      high: bikeHi,
      exact: false,
      // Not a detail to bury: the Karnataka High Court lifted the ban in
      // January 2026, the state appealed to the Supreme Court, and there was
      // an enforcement drive in August 2026. Availability genuinely varies.
      note: 'Legal status under appeal — availability varies',
    },
    {
      mode: 'auto-meter',
      label: 'Auto by meter',
      low: meter,
      high: meter,
      exact: true,
      note: night ? 'Night tariff, 1.5× after 10pm' : 'Government rate — insist on the meter',
    },
    { mode: 'auto-app', label: 'Auto on an app', low: autoLo, high: autoHi, exact: false },
    { mode: 'cab', label: 'Cab', low: cabLo, high: cabHi, exact: false },
  ];
}

/**
 * Deep links that open the app when installed and fall back to the web or
 * store when not. Each was checked to resolve rather than 404.
 *
 * Uber and Ola accept a destination; Rapido and Namma Yatri have no
 * documented public deep-link format, so they open cold rather than shipping
 * a fabricated URL that breaks silently.
 */
export function rideAppLinks(lat: number, lon: number, stationName: string) {
  const uber = new URLSearchParams({
    action: 'setPickup',
    pickup: 'my_location',
    'dropoff[latitude]': String(lat),
    'dropoff[longitude]': String(lon),
    'dropoff[nickname]': `${stationName} Metro`,
  });
  const ola = new URLSearchParams({
    drop_lat: String(lat),
    drop_lng: String(lon),
    category: 'auto',
  });
  return [
    // Bengaluru's own driver-owned, zero-commission app. Listed first on a
    // civic tool because it is the option that keeps the fare with the driver.
    { name: 'Namma Yatri', href: 'https://nammayatri.in/', hasDestination: false },
    { name: 'Rapido', href: 'https://www.rapido.bike/', hasDestination: false },
    { name: 'Uber', href: `https://m.uber.com/ul/?${uber.toString()}`, hasDestination: true },
    { name: 'Ola', href: `https://book.olacabs.com/?${ola.toString()}`, hasDestination: true },
  ];
}

export interface AppMode {
  kind: 'bike' | 'auto' | 'cab';
  label: string;
  low: number;
  high: number;
}

export interface RideApp {
  name: string;
  href: string;
  hasDestination: boolean;
  modes: AppMode[];
  note?: string;
}

/**
 * What each app will roughly charge, by vehicle.
 *
 * Why apps differ at all, rather than every one of them showing the same
 * three numbers:
 *
 *  - Namma Yatri prices autos off the government meter and takes zero
 *    commission, with no rider booking or convenience fee — drivers are paid
 *    directly. Its auto fare therefore sits at or just above the meter
 *    instead of 30-90% over it.
 *  - Uber and Ola moved autos to zero commission for DRIVERS (Uber in Feb
 *    2025, Ola in June 2025), but riders are still charged demand pricing,
 *    so they keep the wider band.
 *  - Rapido is the bike-first operator and undercuts on bike and auto, but
 *    its cabs are not reliably cheaper — a 2km Bengaluru trip quoted higher
 *    on Rapido cab than Uber cab. So no cab discount is claimed.
 *
 * Still estimates, and still labelled as such in the UI. The one number
 * anyone can hold a driver to is the meter.
 */
export function rideApps(
  straightLineKm: number,
  hour: number,
  lat: number,
  lon: number,
  stationName: string,
): RideApp[] {
  const meter = meteredAutoFare(straightLineKm, hour);
  const options = rideOptions(straightLineKm, hour);
  const get = (mode: RideMode) => options.find((o) => o.mode === mode)!;

  const r5 = (n: number) => Math.round(n / 5) * 5;
  const bike = get('bike');
  const appAuto = get('auto-app');
  const cab = get('cab');

  // Metered, plus the room a tip or surge still leaves.
  const meterAuto: AppMode = { kind: 'auto', label: 'Auto', low: meter, high: Math.max(meter + 10, r5(meter * 1.25)) };
  const demandAuto: AppMode = { kind: 'auto', label: 'Auto', low: appAuto.low, high: appAuto.high };
  // Rapido undercuts on auto but is not a different vehicle, so it sits
  // between the meter and the full demand band rather than below the meter.
  const rapidoAuto: AppMode = { kind: 'auto', label: 'Auto', low: Math.max(meter, r5(appAuto.low * 0.8)), high: r5(appAuto.high * 0.85) };
  const bikeMode: AppMode = { kind: 'bike', label: 'Bike', low: bike.low, high: bike.high };
  const cabMode: AppMode = { kind: 'cab', label: 'Cab', low: cab.low, high: cab.high };

  const links = rideAppLinks(lat, lon, stationName);
  const href = (name: string) => links.find((l) => l.name === name)!;

  return [
    {
      ...href('Namma Yatri'),
      modes: [meterAuto, cabMode],
      note: 'Meter-priced, zero commission',
    },
    {
      ...href('Rapido'),
      modes: [bikeMode, rapidoAuto, cabMode],
      note: 'Usually cheapest',
    },
    { ...href('Uber'), modes: [bikeMode, demandAuto, cabMode], note: 'Demand pricing' },
    { ...href('Ola'), modes: [bikeMode, demandAuto, cabMode], note: 'Demand pricing' },
  ];
}

/**
 * Below this the answer is "walk" and a ride card would be noise.
 * 1 km is roughly a 15 minute walk at the padded pace used elsewhere.
 */
export const WALKABLE_KM = 1;
