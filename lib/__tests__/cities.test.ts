import { describe, expect, it } from 'vitest';
import { METRO_CITIES, isInIndia, nearestMetroCity } from '../cities';
import { haversineKm } from '../geo';

const near = (lat: number, lon: number) => nearestMetroCity(lat, lon, haversineKm);

describe('isInIndia', () => {
  it('accepts points across the country', () => {
    expect(isInIndia(12.9716, 77.5946)).toBe(true);  // Bengaluru
    expect(isInIndia(28.6139, 77.2090)).toBe(true);  // Delhi
    expect(isInIndia(34.0837, 74.7973)).toBe(true);  // Srinagar
    expect(isInIndia(8.0883, 77.5385)).toBe(true);   // Kanyakumari
    expect(isInIndia(26.1445, 91.7362)).toBe(true);  // Guwahati
  });

  it('rejects points abroad', () => {
    expect(isInIndia(25.2048, 55.2708)).toBe(false); // Dubai
    expect(isInIndia(51.5074, -0.1278)).toBe(false); // London
    expect(isInIndia(1.3521, 103.8198)).toBe(false); // Singapore
    expect(isInIndia(40.7128, -74.0060)).toBe(false); // New York
  });
});

describe('nearestMetroCity', () => {
  it('identifies the city someone is standing in', () => {
    expect(near(13.0827, 80.2707)?.city.name).toBe('Chennai');
    expect(near(17.3850, 78.4867)?.city.name).toBe('Hyderabad');
    expect(near(22.5726, 88.3639)?.city.name).toBe('Kolkata');
    expect(near(19.0760, 72.8777)?.city.name).toBe('Mumbai');
  });

  it('covers the wider metropolitan area, not just the centre pin', () => {
    // Gurugram is ~30km from the Delhi anchor and is still Delhi Metro's.
    expect(near(28.4595, 77.0266)?.city.name).toBe('Delhi');
  });

  it('returns null in places with no metro rather than naming a distant city', () => {
    expect(near(15.2993, 74.1240)).toBeNull();  // Goa
    expect(near(24.5854, 73.7125)).toBeNull();  // Udaipur
    expect(near(11.0168, 76.9558)).toBeNull();  // Coimbatore
  });

  it('does not claim an Indian city for someone abroad', () => {
    expect(near(25.2048, 55.2708)).toBeNull();  // Dubai
    expect(near(51.5074, -0.1278)).toBeNull();  // London
  });

  it('still resolves Bengaluru itself, so the caller orders the checks', () => {
    // Bengaluru is absent from the table on purpose — this site IS Bengaluru.
    expect(METRO_CITIES.some((c) => c.name === 'Bengaluru')).toBe(false);
  });
});

describe('METRO_CITIES data', () => {
  it('has plausible Indian coordinates for every entry', () => {
    for (const city of METRO_CITIES) {
      expect(isInIndia(city.lat, city.lon), city.name).toBe(true);
    }
  });

  it('uses https for every operator link', () => {
    for (const city of METRO_CITIES) {
      expect(new URL(city.url).protocol, city.name).toBe('https:');
    }
  });

  it('has no duplicate city names', () => {
    const names = METRO_CITIES.map((c) => c.name);
    expect(new Set(names).size).toBe(names.length);
  });
});
