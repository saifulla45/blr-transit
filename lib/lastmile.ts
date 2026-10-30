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

/**
 * Namma Yatri's own auto rate, which is NOT the government meter.
 *
 * Reported August 2026: 40 rupees for the first 2 km, then 19/km, plus a
 * pickup fee and 1.50/min waiting after three minutes. The pickup fee is
 * unpublished, so it lives in the top of the range rather than as a number.
 */
export const NAMMA_YATRI_AUTO = {
  baseRupees: 40,
  baseKm: 2,
  perKmRupees: 19,
  lastVerified: '2026-10-27',
} as const;

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
  // A 9 km trip came in at 1.34-1.62x the meter; reports reach nearly double.
  'auto-app': [1.3, 2.0],
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
 * Only Uber documents a link that fills in the trip. Ola's web URL opens the
 * app but the app drops its parameters, and Rapido and Namma Yatri publish
 * no format, so those three open cold rather than claiming a destination.
 *
 * `from` is the rider's fix, handed only to the app they tapped; without it
 * Uber falls back to the phone's own location.
 */
export function rideAppLinks(
  lat: number,
  lon: number,
  stationName: string,
  from?: { lat: number; lon: number },
) {
  const uber = new URLSearchParams({ action: 'setPickup' });
  if (from) {
    uber.set('pickup[latitude]', String(from.lat));
    uber.set('pickup[longitude]', String(from.lon));
    uber.set('pickup[nickname]', 'Your location');
  } else {
    uber.set('pickup', 'my_location');
  }
  uber.set('dropoff[latitude]', String(lat));
  uber.set('dropoff[longitude]', String(lon));
  uber.set('dropoff[nickname]', `${stationName} Metro`);
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
    { name: 'Ola', href: `https://book.olacabs.com/?${ola.toString()}`, hasDestination: false },
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
 *  - Namma Yatri runs its own rate card (NAMMA_YATRI_AUTO), a little above
 *    the meter, and takes zero commission. In a reported 9 km comparison it
 *    was the cheapest auto of the four.
 *  - Uber and Ola moved autos to zero commission for DRIVERS (Uber in Feb
 *    2025, Ola in June 2025), but riders are still charged demand pricing,
 *    so they keep the wider band.
 *  - Rapido was assumed to undercut on autos; that same 9 km trip was 263
 *    rupees on Rapido against 204-220 elsewhere, so no discount is claimed.
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
  from?: { lat: number; lon: number },
): RideApp[] {
  const options = rideOptions(straightLineKm, hour);
  const get = (mode: RideMode) => options.find((o) => o.mode === mode)!;

  const r5 = (n: number) => Math.round(n / 5) * 5;
  const bike = get('bike');
  const appAuto = get('auto-app');
  const cab = get('cab');

  // Same road correction and night rule as the meter; top leaves room for the pickup fee.
  const nyRoadKm = straightLineKm * ROAD_FACTOR;
  const nyBase = NAMMA_YATRI_AUTO.baseRupees
    + Math.max(0, nyRoadKm - NAMMA_YATRI_AUTO.baseKm) * NAMMA_YATRI_AUTO.perKmRupees;
  const nyFare = Math.round(isNightTariff(hour) ? nyBase * AUTO_TARIFF.nightMultiplier : nyBase);
  const nyAuto: AppMode = { kind: 'auto', label: 'Auto', low: nyFare, high: Math.max(nyFare + 15, r5(nyFare * 1.25)) };
  const demandAuto: AppMode = { kind: 'auto', label: 'Auto', low: appAuto.low, high: appAuto.high };
  const bikeMode: AppMode = { kind: 'bike', label: 'Bike', low: bike.low, high: bike.high };
  const cabMode: AppMode = { kind: 'cab', label: 'Cab', low: cab.low, high: cab.high };

  const links = rideAppLinks(lat, lon, stationName, from);
  const href = (name: string) => links.find((l) => l.name === name)!;

  return [
    {
      ...href('Namma Yatri'),
      modes: [nyAuto, cabMode],
      note: 'Zero commission',
    },
    {
      ...href('Rapido'),
      modes: [bikeMode, demandAuto, cabMode],
      note: 'Demand pricing',
    },
    { ...href('Uber'), modes: [bikeMode, demandAuto, cabMode], note: 'Demand pricing' },
    { ...href('Ola'), modes: [bikeMode, demandAuto, cabMode], note: 'Demand pricing' },
  ];
}

/**
 * Below this the answer is simply "walk", and fares are noise.
 *
 * 700m, about an 11 minute walk at the padded pace used here. Set from the
 * real complaint: at 1km the card offered a 100 rupee cab for a 52 metre,
 * one minute walk, which nobody would book and which made every other
 * number on the card look unconsidered too.
 *
 * Erring high would be the worse mistake. Showing a fare nobody needs
 * costs credibility on the whole card; omitting one for a 750m walk costs
 * a tap on an app the reader already has.
 */
export const WALKABLE_KM = 0.7;
