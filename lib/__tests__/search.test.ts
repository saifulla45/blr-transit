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

describe('matchByName — the gaps the bus search had too', () => {
  const S = [
    { name: 'Mahatma Gandhi Road' },
    { name: 'Rashtreeya Vidyalaya Road' },
    { name: 'Jaya Prakash Nagar' },
    { name: 'Krishna Rajendra Market' },
    { name: 'Swami Vivekananda Road' },
    { name: 'Halasuru' },
    { name: 'Krishnarajapura' },
    { name: 'Jayanagar' },
    { name: 'Baiyappanahalli' },
    { name: 'Banashankari' },
    { name: 'Thalaghattapura' },
    { name: 'Jnanabharathi' },
    { name: 'Trinity' },
  ];
  const first = (q: string) => matchByName(S, q, 1)[0]?.name;

  it('resolves the initialisms people actually type', () => {
    // No amount of letter-folding gets "mgroad" inside "mahatmagandhiroad".
    expect(first('mg road')).toBe('Mahatma Gandhi Road');
    expect(first('m g road')).toBe('Mahatma Gandhi Road');
    expect(first('rv road')).toBe('Rashtreeya Vidyalaya Road');
    expect(first('jp nagar')).toBe('Jaya Prakash Nagar');
    expect(first('kr market')).toBe('Krishna Rajendra Market');
    expect(first('sv road')).toBe('Swami Vivekananda Road');
  });

  it('knows the colloquial names that share no letters with the official one', () => {
    expect(first('ulsoor')).toBe('Halasuru');
    expect(first('kr puram')).toBe('Krishnarajapura');
    expect(first('bangalore university')).toBe('Jnanabharathi');
  });

  it('tolerates the spelling a person would guess', () => {
    expect(first('jaynagar')).toBe('Jayanagar');
    expect(first('byappanahalli')).toBe('Baiyappanahalli');
    expect(first('banshankari')).toBe('Banashankari');
    expect(first('talaghattapura')).toBe('Thalaghattapura');
  });

  it('still puts an exact name first rather than a fuzzy neighbour', () => {
    expect(first('Jayanagar')).toBe('Jayanagar');
    expect(first('Trinity')).toBe('Trinity');
    expect(first('Halasuru')).toBe('Halasuru');
  });

  it('returns nothing for a query that is not a station', () => {
    // The fuzzy pass must not turn every query into a match.
    for (const q of ['zzzzz', 'qwerty', 'london', 'xyzzy']) {
      expect(matchByName(S, q, 3), q).toHaveLength(0);
    }
  });
});
