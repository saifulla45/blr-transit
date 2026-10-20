/**
 * Who is standing outside Bengaluru, and what is useful to tell them.
 *
 * The site is reachable from anywhere now, so "you are not in Bengaluru" is
 * a dead end rather than an answer. Someone opening this in Chennai is not
 * confused about where they are — they want to know whether this helps them,
 * and if not, what does. So we name their city and hand them their own
 * operator.
 *
 * This is a static table on purpose. A reverse-geocoding call would be a
 * runtime network dependency, a privacy leak of the user's coordinates to a
 * third party, and a thing that breaks when the site is offline — to print a
 * city name the user already knows.
 */

export interface MetroCity {
  name: string;
  lat: number;
  lon: number;
  /** The operator's own site, so nobody is sent to a scraper or aggregator. */
  system: string;
  url: string;
}

/**
 * Indian cities with an operating metro. Coordinates are city centre, which
 * is accurate enough to answer "which city am I nearest" and nothing more.
 */
export const METRO_CITIES: MetroCity[] = [
  { name: 'Delhi', lat: 28.6139, lon: 77.2090, system: 'Delhi Metro', url: 'https://www.delhimetrorail.com/' },
  { name: 'Noida', lat: 28.5355, lon: 77.3910, system: 'Noida Metro', url: 'https://www.noidametrorail.com/' },
  { name: 'Mumbai', lat: 19.0760, lon: 72.8777, system: 'Mumbai Metro', url: 'https://mmrda.maharashtra.gov.in/' },
  { name: 'Kolkata', lat: 22.5726, lon: 88.3639, system: 'Kolkata Metro', url: 'https://mtp.indianrailways.gov.in/' },
  { name: 'Chennai', lat: 13.0827, lon: 80.2707, system: 'Chennai Metro', url: 'https://chennaimetrorail.org/' },
  { name: 'Hyderabad', lat: 17.3850, lon: 78.4867, system: 'Hyderabad Metro', url: 'https://www.ltmetro.com/' },
  { name: 'Pune', lat: 18.5204, lon: 73.8567, system: 'Pune Metro', url: 'https://www.punemetrorail.org/' },
  { name: 'Ahmedabad', lat: 23.0225, lon: 72.5714, system: 'Gujarat Metro', url: 'https://www.gujaratmetrorail.com' },
  { name: 'Surat', lat: 21.1702, lon: 72.8311, system: 'Gujarat Metro', url: 'https://www.gujaratmetrorail.com' },
  { name: 'Jaipur', lat: 26.9124, lon: 75.7873, system: 'Jaipur Metro', url: 'https://transport.rajasthan.gov.in/jmrc' },
  { name: 'Lucknow', lat: 26.8467, lon: 80.9462, system: 'Lucknow Metro', url: 'https://www.lmrcl.com/' },
  { name: 'Kanpur', lat: 26.4499, lon: 80.3319, system: 'Kanpur Metro', url: 'https://www.upmetrorail.com/' },
  { name: 'Agra', lat: 27.1767, lon: 78.0081, system: 'Agra Metro', url: 'https://www.upmetrorail.com/' },
  { name: 'Kochi', lat: 9.9312, lon: 76.2673, system: 'Kochi Metro', url: 'https://kochimetro.org/' },
  { name: 'Nagpur', lat: 21.1458, lon: 79.0882, system: 'Nagpur Metro', url: 'https://www.mahametro.org/' },
  { name: 'Bhopal', lat: 23.2599, lon: 77.4126, system: 'Madhya Pradesh Metro', url: 'https://www.mpmetrorail.com/' },
  { name: 'Indore', lat: 22.7196, lon: 75.8577, system: 'Madhya Pradesh Metro', url: 'https://www.mpmetrorail.com/' },
  { name: 'Patna', lat: 25.5941, lon: 85.1376, system: 'Patna Metro', url: 'https://www.pmrcl.in/' },
];

/**
 * Rough land extent of India. Only used to distinguish "elsewhere in India"
 * from "abroad", which changes the wording and nothing else — so a loose box
 * is fine and a precise polygon would be false rigour.
 */
const INDIA_BBOX = { minLat: 6.5, maxLat: 37.2, minLon: 68.0, maxLon: 97.5 };

export function isInIndia(lat: number, lon: number): boolean {
  return lat >= INDIA_BBOX.minLat && lat <= INDIA_BBOX.maxLat
    && lon >= INDIA_BBOX.minLon && lon <= INDIA_BBOX.maxLon;
}

/**
 * How close you must be to a city centre before we claim you are in it.
 * Generous, because these are metropolitan areas and the anchor is a single
 * downtown point — Gurugram is 30km from Connaught Place and is still Delhi
 * Metro's problem.
 */
const CITY_MATCH_KM = 70;

/**
 * The nearest city with a metro, if one is close enough to be useful.
 * Returns null rather than naming a city 400km away.
 */
export function nearestMetroCity(
  lat: number,
  lon: number,
  distance: (aLat: number, aLon: number, bLat: number, bLon: number) => number,
): { city: MetroCity; distanceKm: number } | null {
  let best: { city: MetroCity; distanceKm: number } | null = null;
  for (const city of METRO_CITIES) {
    const distanceKm = distance(lat, lon, city.lat, city.lon);
    if (!best || distanceKm < best.distanceKm) best = { city, distanceKm };
  }
  return best && best.distanceKm <= CITY_MATCH_KM ? best : null;
}
