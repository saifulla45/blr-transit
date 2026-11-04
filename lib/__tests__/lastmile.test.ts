import { describe, expect, it } from 'vitest';
import {
  AUTO_TARIFF, NAMMA_YATRI_AUTO, ROAD_FACTOR, isNightTariff, meteredAutoFare, rideAppLinks, detectPlatform, rideOptions,
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


  it('lists Namma Yatri first', () => {
    expect(links[0].name).toBe('Namma Yatri');
  });




  it('sends desktop riders to Uber web booking with the drop as a place', () => {
    const uber = new URL(links.find((l) => l.name === 'Uber')!.href);
    expect(uber.pathname).toBe('/go/product-selection');
    expect(JSON.parse(uber.searchParams.get('drop[0]')!)).toEqual(
      { latitude: 12.9784, longitude: 77.6408, addressLine1: 'Indiranagar Metro Station' },
    );
  });

  it('claims a prefilled trip for Uber and Ola on the web', () => {
    expect(links.filter((l) => l.hasDestination).map((l) => l.name)).toEqual(['Uber', 'Ola']);
  });

  it('puts the rider fix and the station into both web booking pages', () => {
    const web = rideAppLinks(12.9784, 77.6408, 'Indiranagar', { lat: 12.97, lon: 77.62 });
    const uber = new URL(web.find((l) => l.name === 'Uber')!.href);
    expect(JSON.parse(uber.searchParams.get('pickup')!)).toMatchObject({ latitude: 12.97, longitude: 77.62 });
    const ola = new URL(web.find((l) => l.name === 'Ola')!.href);
    expect([ola.searchParams.get('lat'), ola.searchParams.get('lng')]).toEqual(['12.97', '77.62']);
    expect([ola.searchParams.get('drop_lat'), ola.searchParams.get('drop_lng')]).toEqual(['12.9784', '77.6408']);
  });

  it('leaves Uber web pickup for the rider to set without a fix', () => {
    const uber = new URL(links.find((l) => l.name === 'Uber')!.href);
    expect(uber.searchParams.get('pickup')).toBeNull();
  });

  it('uses the setPickup universal link on iOS', () => {
    const ios = rideAppLinks(12.9784, 77.6408, 'Indiranagar', { lat: 12.97, lon: 77.62 }, 'ios');
    const uber = new URL(ios.find((l) => l.name === 'Uber')!.href);
    expect(uber.pathname).toBe('/ul/');
    expect(uber.searchParams.get('pickup[latitude]')).toBe('12.97');
    expect(uber.searchParams.get('dropoff[latitude]')).toBe('12.9784');
    const ola = new URL(ios.find((l) => l.name === 'Ola')!.href);
    expect(ola.host).toBe('olawebcdn.com');
    expect([ola.searchParams.get('lat'), ola.searchParams.get('drop_lat')]).toEqual(['12.97', '12.9784']);
  });

  it('opens Rapido and Namma Yatri through their registered app links on iPhone', () => {
    const links = rideAppLinks(12.9784, 77.6408, 'Indiranagar', undefined, 'ios');
    expect(links.find((l) => l.name === 'Rapido')!.href).toMatch(/^https:\/\/rapido\.onelink\.me\/Ewte\//);
    expect(links.find((l) => l.name === 'Namma Yatri')!.href).toBe('https://nammayatri.in/u');
  });

  it('hands Namma Yatri the station as a geo: destination on Android', () => {
    const ny = rideAppLinks(12.9784, 77.6408, 'Indiranagar', undefined, 'android')
      .find((l) => l.name === 'Namma Yatri')!;
    // The app reads comma-parts 0 and 2 of the scheme-specific part.
    expect(ny.href.startsWith('intent:12.9784,77.6408?q=12.9784,77.6408#Intent;scheme=geo;package=in.juspay.nammayatri;')).toBe(true);
    const ssp = ny.href.slice('intent:'.length, ny.href.indexOf('#')).split(',');
    expect([Number(ssp[0]), Number(ssp[2])]).toEqual([12.9784, 77.6408]);
    expect(ny.prefill).toBe('trip');
    expect(decodeURIComponent(ny.href.match(/S\.browser_fallback_url=([^;]+)/)![1])).toBe('https://nammayatri.in/u');
  });

  it('offers Rapido the same location on Android without claiming it is filled in', () => {
    const rapido = rideAppLinks(12.9784, 77.6408, 'Indiranagar', undefined, 'android')
      .find((l) => l.name === 'Rapido')!;
    expect(rapido.href).toContain('scheme=geo;package=com.rapido.passenger;');
    expect(rapido.prefill).toBe('none');
  });

  it('produces parseable absolute https urls', () => {
    for (const link of links) {
      const url = new URL(link.href);
      expect(url.protocol).toBe('https:');
    }
  });
});

describe('rideAppLinks on Android', () => {
  const fix = { lat: 12.97, lon: 77.62 };
  const links = rideAppLinks(12.9784, 77.6408, 'Indiranagar', fix, 'android');
  const intentQuery = (href: string) => new URLSearchParams(href.slice(href.indexOf('?') + 1, href.indexOf('#')));

  it('opens Uber by its own scheme with pickup and drop attached', () => {
    const uber = links.find((l) => l.name === 'Uber')!;
    expect(uber.href).toMatch(/^intent:\/\/\?action=setPickup/);
    expect(uber.href).toContain(';scheme=uber;package=com.ubercab;');
    const q = intentQuery(uber.href);
    expect(q.get('pickup[latitude]')).toBe('12.97');
    expect(q.get('dropoff[latitude]')).toBe('12.9784');
    expect(q.get('dropoff[nickname]')).toBe('Indiranagar Metro Station');
  });

  it('falls back to the Uber web link when the app is missing', () => {
    const uber = links.find((l) => l.name === 'Uber')!;
    const fallback = decodeURIComponent(uber.href.match(/S\.browser_fallback_url=([^;]+)/)![1]);
    expect(fallback.startsWith('https://m.uber.com/go/product-selection?')).toBe(true);
  });

  it('hands Ola the pickup and drop through its launch scheme', () => {
    const ola = links.find((l) => l.name === 'Ola')!;
    expect(ola.href).toContain(';scheme=olacabs;package=com.olacabs.customer;');
    const q = intentQuery(ola.href);
    expect([q.get('lat'), q.get('lng')]).toEqual(['12.97', '77.62']);
    expect([q.get('drop_lat'), q.get('drop_lng')]).toEqual(['12.9784', '77.6408']);
    expect(ola.prefill).toBe('trip');
  });

  it('only Rapido still needs the station pasted on Android', () => {
    expect(links.filter((l) => l.prefill === 'none').map((l) => l.name)).toEqual(['Rapido']);
  });

  it('falls back to the Ola universal link when the app is missing', () => {
    const ola = links.find((l) => l.name === 'Ola')!;
    const fallback = decodeURIComponent(ola.href.match(/S\.browser_fallback_url=([^;]+)/)![1]);
    expect(fallback.startsWith('https://olawebcdn.com/assets/ola-universal-link.html?')).toBe(true);
  });

  it('keeps https links on iOS, where a missing app breaks a custom scheme', () => {
    for (const link of rideAppLinks(12.9784, 77.6408, 'Indiranagar', fix, 'ios')) {
      expect(new URL(link.href).protocol).toBe('https:');
    }
  });
});

describe('detectPlatform', () => {
  it('reads Android, iPhone and desktop agents', () => {
    expect(detectPlatform('Mozilla/5.0 (Linux; Android 15; Pixel 9)')).toBe('android');
    expect(detectPlatform('Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X)')).toBe('ios');
    expect(detectPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 15_0)')).toBe('other');
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
