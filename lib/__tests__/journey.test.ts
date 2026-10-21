import { describe, expect, it } from 'vitest';
import {
  findChangeJourneys, findDirectBuses, nearestStops, searchStops, stopsInLocality,
} from '../journey';
import type { BusNetwork } from '@/types/transit';

/*
  A junction BMTC would name several ways, which is the situation that made
  the real search say "no direct bus" about a journey with twelve of them.
*/
const NET: BusNetwork = {
  stops: {
    a1: { name: 'Garudacharpalya', lat: 12.9959, lon: 77.7140 },
    a2: { name: 'Garudacharpalya', lat: 12.9961, lon: 77.7142 },
    h1: { name: 'Hebbala', lat: 13.0358, lon: 77.5970 },
    h2: { name: 'Hebbala Bridge', lat: 13.0365, lon: 77.5975 },
    h3: { name: 'Depot-28 Hebbala', lat: 13.0370, lon: 77.5980 },
    w1: { name: 'White Field Bus Station', lat: 12.9698, lon: 77.7500 },
    mid: { name: 'Corporation', lat: 12.9700, lon: 77.5900 },
    far: { name: 'Elsewhere', lat: 12.8000, lon: 77.4000 },
  },
  routes: {
    r1: { name: '500-HC', long: 'X to Hebbala Bridge', stops: ['a1', 'mid', 'h2'] },
    r2: { name: '201', long: 'Garudacharpalya to Corporation', stops: ['a2', 'mid'] },
    r3: { name: '301', long: 'Corporation to Elsewhere', stops: ['mid', 'far'] },
  },
} as unknown as BusNetwork;

const stop = (id: string) => ({
  id, name: NET.stops[id].name, lat: NET.stops[id].lat, lon: NET.stops[id].lon, distance: 0,
});

describe('stopsInLocality', () => {
  it('gathers the differently-named stops around one junction', () => {
    // The bug: picking "Hebbala" missed routes calling at "Hebbala Bridge".
    const ids = stopsInLocality(NET, stop('h1'));
    expect(ids.has('h1')).toBe(true);
    expect(ids.has('h2')).toBe(true);
    expect(ids.has('h3')).toBe(true);
  });

  it('matches a whole word, never a chance substring', () => {
    const ids = stopsInLocality(NET, stop('h1'));
    expect(ids.has('w1')).toBe(false);
    expect(ids.has('far')).toBe(false);
  });

  it('groups both directions of the same stop', () => {
    const ids = stopsInLocality(NET, stop('a1'));
    expect(ids.has('a2')).toBe(true);
  });
});

describe('findDirectBuses', () => {
  it('finds the route the exact-name match used to miss', () => {
    const found = findDirectBuses(NET, stopsInLocality(NET, stop('a1')), stopsInLocality(NET, stop('h1')));
    expect(found.map((b) => b.name)).toContain('500-HC');
  });

  it('will not travel a route backwards', () => {
    // Nothing runs Hebbala -> Garudacharpalya in this fixture.
    expect(findDirectBuses(NET, stopsInLocality(NET, stop('h1')), stopsInLocality(NET, stop('a1'))))
      .toHaveLength(0);
  });
});

describe('findChangeJourneys', () => {
  it('offers two buses when none runs the whole way', () => {
    const out = findChangeJourneys(NET, stopsInLocality(NET, stop('a1')), stopsInLocality(NET, stop('far')));
    expect(out.length).toBeGreaterThan(0);
    expect(out[0].changeAt).toBe('Corporation');
    expect(out[0].first.name).toBeTruthy();
    expect(out[0].second.name).toBe('301');
  });

  it('changes only at a stop reached after boarding and before alighting', () => {
    for (const j of findChangeJourneys(NET, stopsInLocality(NET, stop('a1')), stopsInLocality(NET, stop('far')))) {
      expect(j.first.stopCount).toBeGreaterThan(0);
      expect(j.second.stopCount).toBeGreaterThan(0);
      expect(j.totalStops).toBe(j.first.stopCount + j.second.stopCount);
    }
  });

  it('never routes a journey through the same bus twice', () => {
    for (const j of findChangeJourneys(NET, stopsInLocality(NET, stop('a1')), stopsInLocality(NET, stop('far')))) {
      expect(j.first.routeId).not.toBe(j.second.routeId);
    }
  });
});

describe('searchStops', () => {
  it('finds a place spelled with a space in the data', () => {
    // "Whitefield" returned nothing because BMTC writes "White Field".
    expect(searchStops(NET, 'Whitefield').map((s) => s.name)).toContain('White Field Bus Station');
  });

  it('returns every distinct place, not every stop record', () => {
    const r = searchStops(NET, 'Garudacharpalya');
    expect(r).toHaveLength(1);
  });

  it('ranks the plain name above the qualified ones', () => {
    expect(searchStops(NET, 'Hebbala')[0].name).toBe('Hebbala');
  });

  it('finds all the variants of a name', () => {
    expect(searchStops(NET, 'Hebbala').map((s) => s.name)).toEqual(
      expect.arrayContaining(['Hebbala', 'Hebbala Bridge', 'Depot-28 Hebbala']),
    );
  });

  it('returns nothing for a query that matches nothing', () => {
    expect(searchStops(NET, 'xyzzyq')).toHaveLength(0);
  });

  it('ignores a query too short to be meaningful', () => {
    expect(searchStops(NET, 'a')).toHaveLength(0);
  });
});

describe('nearestStops', () => {
  it('lists each place once, keeping the nearest side', () => {
    // Both Garudacharpalya records are within range; only one should show.
    const near = nearestStops(NET, 12.9959, 77.7140, 5);
    const names = near.map((s) => s.name);
    expect(new Set(names).size).toBe(names.length);
    expect(names[0]).toBe('Garudacharpalya');
  });
});
