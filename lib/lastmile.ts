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

export type Platform = 'android' | 'ios' | 'other';

/** How much of the trip an app link fills in when it opens. */
export type Prefill = 'trip' | 'none';

export interface RideAppLink {
  name: string;
  href: string;
  /** True when the link carries pickup and destination into the app. */
  hasDestination: boolean;
  prefill: Prefill;
}

/** Best guess from the user agent; anything unrecognised gets plain web links. */
export function detectPlatform(userAgent: string): Platform {
  if (/android/i.test(userAgent)) return 'android';
  if (/iphone|ipad|ipod/i.test(userAgent)) return 'ios';
  return 'other';
}

/**
 * An Android intent URL: opens the named app by its own scheme, and sends
 * the browser to `fallback` when the app is not installed.
 *
 * Chrome on Android hands an https universal link to Uber without its query
 * string often enough that riders saw an empty booking screen. Addressing
 * the app's own scheme through an intent keeps the parameters attached.
 */
function androidIntent(schemeUrl: string, pkg: string, fallback: string): string {
  const [scheme, rest] = schemeUrl.split('://');
  return `intent://${rest}#Intent;scheme=${scheme};package=${pkg};`
    + `S.browser_fallback_url=${encodeURIComponent(fallback)};end`;
}

/**
 * Links that open each ride app with the trip filled in where the app
 * supports it: pickup at the rider's fix, destination at the station.
 *
 * Verified by loading each web URL in a browser (2026-11-04): Uber's
 * /go/product-selection page and Ola's book.olacabs.com both showed the
 * pickup and drop addresses already filled in. The app links follow each
 * company's documented format: Uber's setPickup, and Ola's olacabs:// scheme
 * and olawebcdn.com universal link. Android opens the app through an intent
 * and falls back to a web page when the app is missing.
 *
 * Namma Yatri takes a destination on Android through a geo: link (see
 * geoIntent); its iPhone app and Rapido publish no way to pass a trip, so
 * those links only open the app and the UI copies the station name.
 */
export function rideAppLinks(
  lat: number,
  lon: number,
  stationName: string,
  from?: { lat: number; lon: number },
  platform: Platform = 'other',
): RideAppLink[] {
  const destination = `${stationName} Metro Station`;

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
  uber.set('dropoff[nickname]', destination);

  // Uber's web booking reads JSON places; without a fix it asks for pickup.
  const uberWebQuery = new URLSearchParams();
  if (from) {
    uberWebQuery.set('pickup', JSON.stringify({ latitude: from.lat, longitude: from.lon, addressLine1: 'Your location' }));
  }
  uberWebQuery.set('drop[0]', JSON.stringify({ latitude: lat, longitude: lon, addressLine1: destination }));
  const uberWeb = `https://m.uber.com/go/product-selection?${uberWebQuery.toString()}`;

  const uberHref = platform === 'android'
    ? androidIntent(`uber://?${uber.toString()}`, 'com.ubercab', uberWeb)
    // iOS hands the universal link to the installed app with its parameters.
    : platform === 'ios' ? `https://m.uber.com/ul/?${uber.toString()}`
    : uberWeb;

  const ola = new URLSearchParams();
  if (from) {
    ola.set('lat', String(from.lat));
    ola.set('lng', String(from.lon));
  }
  ola.set('drop_lat', String(lat));
  ola.set('drop_lng', String(lon));
  ola.set('category', 'auto');
  ola.set('utm_source', 'nammacommute');
  const olaWeb = `https://book.olacabs.com/?${ola.toString()}&dsw=yes`;
  ola.set('drop_address', destination);
  ola.set('landing_page', 'bk');
  // Ola's documented universal link: opens the installed app with the trip,
  // where book.olacabs.com loses it at Ola's own "Open in app" button.
  const olaUniversal = `https://olawebcdn.com/assets/ola-universal-link.html?${ola.toString()}`;

  const olaHref = platform === 'android'
    ? androidIntent(`olacabs://app/launch?${ola.toString()}`, 'com.olacabs.customer', olaUniversal)
    : platform === 'ios' ? olaUniversal
    : olaWeb;

  return [
    // Bengaluru's own driver-owned, zero-commission app. Listed first on a
    // civic tool because it is the option that keeps the fare with the driver.
    {
      name: 'Namma Yatri',
      href: platform === 'android'
        ? geoIntent(lat, lon, 'in.juspay.nammayatri', NAMMA_YATRI_APP_LINK)
        : NAMMA_YATRI_APP_LINK,
      hasDestination: platform === 'android',
      prefill: platform === 'android' ? 'trip' : 'none',
    },
    {
      name: 'Rapido',
      href: platform === 'android'
        ? geoIntent(lat, lon, 'com.rapido.passenger', RAPIDO_APP_LINK)
        : platform === 'ios' ? RAPIDO_APP_LINK : 'https://www.rapido.bike/',
      // Unconfirmed whether Rapido reads the location, so the UI still copies it.
      hasDestination: false,
      prefill: 'none',
    },
    { name: 'Uber', href: uberHref, hasDestination: true, prefill: 'trip' },
    { name: 'Ola', href: olaHref, hasDestination: true, prefill: 'trip' },
  ];
}

/*
  App links for the two apps that take no trip details.

  Each domain below publishes the files iOS (apple-app-site-association)
  and Android (assetlinks.json) read to hand a tapped link to the installed
  app, checked 2026-11-04:
    rapido.onelink.me/Ewte/*  bike.rapido.customer (iOS), com.rapido.passenger (Android)
    nammayatri.in/*           in.juspay.nammayatri on both
  So the tap opens the app itself, not a store page or a website asking to
  install what is already installed. Without the app, AppsFlyer and Namma
  Yatri send the rider to the store or their site.
*/
const RAPIDO_APP_LINK = 'https://rapido.onelink.me/Ewte/nammacommute';
// The Android app only claims /u and /refer, not the bare domain.
const NAMMA_YATRI_APP_LINK = 'https://nammayatri.in/u';

/**
 * A geo: location aimed at one app on Android.
 *
 * Namma Yatri's open-source rider app (MainActivity.handleGeoSchemeData,
 * read 2026-11-04) turns a browsable geo: link into its destination and
 * keeps the rider's current location as pickup. It splits the part after
 * "geo:" on commas and reads parts 0 and 2, so the format is exactly
 * "LAT,LON?q=LAT,LON" with no label: "(Name)" would break the longitude.
 * Chrome uses the fallback when the app is missing or does not take geo:.
 */
function geoIntent(lat: number, lon: number, pkg: string, fallback: string): string {
  return `intent:${lat},${lon}?q=${lat},${lon}#Intent;scheme=geo;package=${pkg};`
    + `S.browser_fallback_url=${encodeURIComponent(fallback)};end`;
}

export interface AppMode {
  kind: 'bike' | 'auto' | 'cab';
  label: string;
  low: number;
  high: number;
}

export interface RideApp extends RideAppLink {
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
  platform: Platform = 'other',
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

  const links = rideAppLinks(lat, lon, stationName, from, platform);
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

/**
 * Beyond this, walking minutes stop being advice: the cards drop the walk
 * option and the time, and point to a ride instead. About 50 minutes on foot.
 */
export const WALK_TOO_FAR_KM = 3;
