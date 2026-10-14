import { describe, it, expect } from 'vitest';
import { matchByName, normalizeName } from '../search';

const STATIONS = [
  { name: 'Yeshwantpur' },
  { name: 'Indiranagar' },
  { name: 'Nadaprabhu Kempegowda Station, Majestic' },
  { name: 'Krishnarajapura' },
  { name: 'Whitefield (Kadugodi)' },
  { name: 'Rashtreeya Vidyalaya Road' },
  { name: 'Sandal Soap Factory' },
  { name: 'Jnanabharathi' },
];

describe('normalizeName', () => {
  it('folds v/w so Yeshwantpur and Yesvantpur agree', () => {
    expect(normalizeName('Yeshwantpur')).toBe(normalizeName('Yesvantpur'));
  });

  it('folds aspirated consonants written with or without h', () => {
    expect(normalizeName('Jnanabharathi')).toBe(normalizeName('Gnanabarati'));
  });

  it('folds doubled vowels', () => {
    expect(normalizeName('Rashtreeya')).toBe(normalizeName('Rashtriya'));
  });

  it('ignores punctuation and spacing', () => {
    expect(normalizeName('Whitefield (Kadugodi)')).toBe(normalizeName('whitefield kadugodi'));
  });
});

describe('matchByName', () => {
  it('matches the spelling from the bug report', () => {
    // "yesvan" previously matched nothing at all.
    expect(matchByName(STATIONS, 'yesvan')[0].name).toBe('Yeshwantpur');
  });

  it('matches common alternate romanisations', () => {
    expect(matchByName(STATIONS, 'krishna raja pura')[0].name).toBe('Krishnarajapura');
    expect(matchByName(STATIONS, 'majestic')[0].name).toContain('Majestic');
  });

  it('ranks prefix matches above interior ones', () => {
    const r = matchByName([{ name: 'Nagar Bhavi' }, { name: 'Indiranagar' }], 'nagar');
    expect(r[0].name).toBe('Nagar Bhavi');
  });

  it('ignores queries shorter than two characters', () => {
    expect(matchByName(STATIONS, 'y')).toEqual([]);
  });

  it('returns nothing for a genuine non-match', () => {
    expect(matchByName(STATIONS, 'zzzzz')).toEqual([]);
  });

  it('respects the limit', () => {
    expect(matchByName(STATIONS, 'a', 2).length).toBeLessThanOrEqual(2);
  });
});
