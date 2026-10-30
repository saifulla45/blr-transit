import { describe, expect, it } from 'vitest';
import {
  AUTO_TARIFF, NAMMA_YATRI_AUTO, ROAD_FACTOR, isNightTariff, meteredAutoFare, rideAppLinks, rideOptions,
  rideApps,
} from '../lastmile';

describe('isNightTariff', () => {
  it('covers 10pm to 5am and nothing else', () => {
    expect(isNightTariff(22)).toBe(true);
    expect(isNightTariff(23)).toBe(true);
    expect(isNightTariff(0)).toBe(true);
    expect(isNightTariff(4)).toBe(true);
    // 5am is the first day-tariff hour.
    expect(isNightTariff(5)).toBe(false);
    expect(isNightTariff(12)).toBe(false);
    expect(isNightTariff(21)).toBe(false);
  });
});

describe('meteredAutoFare', () => {
  it('charges the flat minimum inside the base distance', () => {
    // 1km straight line is 1.35km of road, still under the 2km base.
    expect(meteredAutoFare(1, 12)).toBe(AUTO_TARIFF.baseRupees);
  });

  it('matches the published rate card by hand', () => {
    // 4km straight line -> 5.4km road. 36 + (5.4-2)*18 = 36 + 61.2 = 97.2 -> 97
    expect(meteredAutoFare(4, 12)).toBe(97);
  });

  it('applies the road correction rather than using crow-flies', () => {
    // Without ROAD_FACTOR this would be 36 + (3-2)*18 = 54. With it, more.
    expect(meteredAutoFare(3, 12)).toBeGreaterThan(54);
    const roadKm = 3 * ROAD_FACTOR;
    expect(meteredAutoFare(3, 12)).toBe(Math.round(36 + (roadKm - 2) * 18));
  });

  it('applies the 1.5x night tariff, rounding only once', () => {
    // Rounded once at the end rather than multiplying an already-rounded day
    // fare: 5km is 121.5 before rounding, so the night fare is round(182.25)
    // = 182, not round(122 * 1.5) = 183. Double rounding compounds error and
    // would drift further on longer trips.
    const roadKm = 5 * ROAD_FACTOR;
    const unrounded = AUTO_TARIFF.baseRupees + (roadKm - AUTO_TARIFF.baseKm) * AUTO_TARIFF.perKmRupees;
    expect(meteredAutoFare(5, 23)).toBe(Math.round(unrounded * AUTO_TARIFF.nightMultiplier));
    expect(meteredAutoFare(5, 23)).toBe(182);
    expect(meteredAutoFare(5, 12)).toBe(122);
  });

  it('never returns less than the minimum fare, even at zero distance', () => {
    expect(meteredAutoFare(0, 12)).toBe(AUTO_TARIFF.baseRupees);
  });

  it('rises monotonically with distance', () => {
    let previous = 0;
    for (let km = 0; km <= 20; km += 0.5) {
      const fare = meteredAutoFare(km, 12);
      expect(fare).toBeGreaterThanOrEqual(previous);
      previous = fare;
    }
  });
});

describe('rideOptions', () => {
  it('marks only the meter fare as exact', () => {
    const options = rideOptions(4, 12);
    const exact = options.filter((o) => o.exact);
    expect(exact).toHaveLength(1);
    expect(exact[0].mode).toBe('auto-meter');
    // An exact fare is a single number, not a range.
    expect(exact[0].low).toBe(exact[0].high);
  });

  it('gives every estimated mode a real range', () => {
    for (const option of rideOptions(6, 12).filter((o) => !o.exact)) {
      expect(option.high).toBeGreaterThan(option.low);
    }
  });

  it('orders bike cheapest and cab dearest', () => {
    const options = rideOptions(6, 12);
    const by = (m: string) => options.find((o) => o.mode === m)!;
    expect(by('bike').low).toBeLessThan(by('auto-meter').low);
    expect(by('cab').low).toBeGreaterThan(by('auto-app').low);
  });

  it('applies app minimum fares on very short trips', () => {
    // A 1.2km hop: per-km maths alone would undercut what any app will accept.
    const options = rideOptions(1.2, 12);
    expect(options.find((o) => o.mode === 'cab')!.low).toBeGreaterThanOrEqual(100);
    expect(options.find((o) => o.mode === 'bike')!.low).toBeGreaterThanOrEqual(30);
  });

  it('flags the bike taxi legal position rather than presenting it as settled', () => {
    const bike = rideOptions(4, 12).find((o) => o.mode === 'bike')!;
    expect(bike.note).toMatch(/legal/i);
  });

  it('tells people about the night tariff when it applies', () => {
    expect(rideOptions(4, 23).find((o) => o.mode === 'auto-meter')!.note).toMatch(/night/i);
    expect(rideOptions(4, 12).find((o) => o.mode === 'auto-meter')!.note).toMatch(/meter/i);
  });

  it('scales every mode with the night tariff, not just the meter', () => {
    const day = rideOptions(6, 12).find((o) => o.mode === 'cab')!;
    const night = rideOptions(6, 23).find((o) => o.mode === 'cab')!;
    expect(night.low).toBeGreaterThan(day.low);
  });
});

describe('rideAppLinks', () => {
  const links = rideAppLinks(12.9784, 77.6408, 'Indiranagar');

  it('puts the destination in the links that support one', () => {
    for (const link of links.filter((l) => l.hasDestination)) {
      expect(link.href).toContain('12.9784');
      expect(link.href).toContain('77.6408');
    }
  });

  it('encodes the Uber bracket parameters rather than leaving them raw', () => {
    const uber = links.find((l) => l.name === 'Uber')!;
    // Raw brackets in a query string are invalid and silently drop the dropoff.
    expect(uber.href).not.toMatch(/dropoff\[/);
    expect(uber.href).toContain('dropoff%5Blatitude%5D');
  });

  it('lists Namma Yatri first', () => {
    expect(links[0].name).toBe('Namma Yatri');
  });

  it('claims a prefilled destination only for Uber', () => {
    // Ola's app drops the web URL's parameters, confirmed on a phone.
    expect(links.filter((l) => l.hasDestination).map((l) => l.name)).toEqual(['Uber']);
  });

  it('prefills the Uber pickup from the rider fix when there is one', () => {
    const withFix = rideAppLinks(12.9784, 77.6408, 'Indiranagar', { lat: 12.97, lon: 77.62 });
    const uber = new URL(withFix.find((l) => l.name === 'Uber')!.href);
    expect(uber.searchParams.get('pickup[latitude]')).toBe('12.97');
    expect(uber.searchParams.get('pickup[longitude]')).toBe('77.62');
    expect(uber.searchParams.get('pickup')).toBeNull();
  });

  it('falls back to the phone location for Uber pickup without a fix', () => {
    const uber = new URL(links.find((l) => l.name === 'Uber')!.href);
    expect(uber.searchParams.get('pickup')).toBe('my_location');
  });

  it('produces parseable absolute https urls', () => {
    for (const link of links) {
      const url = new URL(link.href);
      expect(url.protocol).toBe('https:');
    }
  });
});

describe('rideApps', () => {
  const apps = (km = 4, hour = 12) => rideApps(km, hour, 12.9784, 77.6408, 'Indiranagar');
  const byName = (n: string, km = 4, hour = 12) => apps(km, hour).find((a) => a.name === n)!;

  it('prices Namma Yatri autos off its own rate card, not the meter', () => {
    const roadKm = 4 * ROAD_FACTOR;
    const expected = Math.round(
      NAMMA_YATRI_AUTO.baseRupees + (roadKm - NAMMA_YATRI_AUTO.baseKm) * NAMMA_YATRI_AUTO.perKmRupees,
    );
    const meter = meteredAutoFare(4, 12);
    const ny = byName('Namma Yatri').modes.find((m) => m.kind === 'auto')!;
    expect(ny.low).toBe(expected);
    expect(ny.low).toBeGreaterThan(meter);

    const uber = byName('Uber').modes.find((m) => m.kind === 'auto')!;
    expect(uber.low).toBeGreaterThan(meter);
  });

  it('never quotes any app below the regulated meter for an auto', () => {
    // An app auto undercutting the legal rate would be a fabricated number.
    const meter = meteredAutoFare(6, 12);
    for (const app of apps(6)) {
      const auto = app.modes.find((m) => m.kind === 'auto');
      if (auto) expect(auto.low, app.name).toBeGreaterThanOrEqual(meter);
    }
  });

  it('claims no auto discount for Rapido', () => {
    // A reported 9 km trip was dearest on Rapido, so it shares the demand band.
    const rapido = byName('Rapido').modes.find((m) => m.kind === 'auto')!;
    const uber = byName('Uber').modes.find((m) => m.kind === 'auto')!;
    expect(rapido).toEqual(uber);
    expect(byName('Rapido').note).not.toMatch(/cheap/i);
  });

  it('claims no cab discount for Rapido', () => {
    // A 2km Bengaluru trip quoted higher on Rapido cab than Uber cab, so
    // the "Rapido is cheaper" generalisation does not extend to cabs.
    const r = byName('Rapido').modes.find((m) => m.kind === 'cab')!;
    const u = byName('Uber').modes.find((m) => m.kind === 'cab')!;
    expect(r.low).toBe(u.low);
    expect(r.high).toBe(u.high);
  });

  it('offers bikes only on the apps that run them', () => {
    expect(byName('Namma Yatri').modes.some((m) => m.kind === 'bike')).toBe(false);
    for (const n of ['Rapido', 'Uber', 'Ola']) {
      expect(byName(n).modes.some((m) => m.kind === 'bike'), n).toBe(true);
    }
  });

  it('gives every mode a real range and keeps it ordered', () => {
    for (const app of apps()) {
      expect(app.modes.length).toBeGreaterThan(0);
      for (const m of app.modes) {
        expect(m.high, `${app.name} ${m.label}`).toBeGreaterThan(m.low);
        expect(m.low).toBeGreaterThan(0);
      }
    }
  });

  it('scales every app with the night tariff', () => {
    for (const name of ['Namma Yatri', 'Rapido', 'Uber', 'Ola']) {
      const day = byName(name, 6, 12).modes.find((m) => m.kind === 'auto')!;
      const night = byName(name, 6, 23).modes.find((m) => m.kind === 'auto')!;
      expect(night.low, name).toBeGreaterThan(day.low);
    }
  });

  it('carries the booking links through unchanged', () => {
    for (const app of apps()) {
      expect(new URL(app.href).protocol).toBe('https:');
      if (app.hasDestination) expect(app.href).toContain('12.9784');
    }
    expect(apps()[0].name).toBe('Namma Yatri');
  });
});
