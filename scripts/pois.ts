/**
 * Fetches nearby points of interest from OpenStreetMap via Overpass, once at
 * build time.
 *
 * Overpass is rate-limited and occasionally slow, so it is never called at
 * runtime — the results are baked into public/data and shipped as static JSON.
 */
import type { Station } from '../types/transit';

// Overpass blocks the default curl/node User-Agent with a 406, so identify.
const UA = 'blr-transit/1.0 (civic transit app; OSM data via Overpass)';
const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

/** How far from a station counts as "nearby", in metres. Roughly a 12 min walk. */
const RADIUS_M = 1000;
/** Most POIs to keep per category per station. */
const PER_CATEGORY = 8;
/**
 * Bengaluru bounding box (S, W, N, E), comfortably covering the whole network.
 * One bbox query per tag beats `around:` over 83 points: exact tag matches hit
 * Overpass's index, whereas a regex or a huge multi-point around forces a scan
 * and the server returns 504.
 */
const BBOX = '12.78,77.40,13.18,77.82';
/** Overpass 429s on rapid-fire queries; pause between them. */
const GAP_MS = 4000;

export type PoiCategory =
  | 'health' | 'food' | 'shopping' | 'worship' | 'money' | 'transport' | 'essentials';

/**
 * OSM tag -> our category and display label.
 *
 * `extraTag` narrows a broad tag that would otherwise be one undifferentiated
 * bucket: every place of worship carries amenity=place_of_worship, and only
 * `religion` separates a temple from a church from a masjid.
 */
const TAGS: Array<{
  key: string; value: string; category: PoiCategory; label: string;
  extraKey?: string; extraValue?: string;
}> = [
  { key: 'amenity', value: 'hospital',    category: 'health',     label: 'Hospital' },
  { key: 'amenity', value: 'clinic',      category: 'health',     label: 'Clinic' },
  { key: 'amenity', value: 'doctors',     category: 'health',     label: 'Doctor' },
  { key: 'amenity', value: 'pharmacy',    category: 'health',     label: 'Pharmacy' },

  { key: 'amenity', value: 'restaurant',  category: 'food',       label: 'Restaurant' },
  { key: 'amenity', value: 'cafe',        category: 'food',       label: 'Cafe' },
  { key: 'amenity', value: 'fast_food',   category: 'food',       label: 'Fast food' },

  { key: 'shop',    value: 'mall',        category: 'shopping',   label: 'Mall' },
  { key: 'shop',    value: 'supermarket', category: 'shopping',   label: 'Supermarket' },
  { key: 'shop',    value: 'convenience', category: 'shopping',   label: 'Grocery' },
  { key: 'shop',    value: 'greengrocer', category: 'shopping',   label: 'Greengrocer' },
  { key: 'amenity', value: 'marketplace', category: 'shopping',   label: 'Market' },

  // Split by religion so a rider can find the specific place they need.
  { key: 'amenity', value: 'place_of_worship', category: 'worship', label: 'Temple',
    extraKey: 'religion', extraValue: 'hindu' },
  { key: 'amenity', value: 'place_of_worship', category: 'worship', label: 'Church',
    extraKey: 'religion', extraValue: 'christian' },
  { key: 'amenity', value: 'place_of_worship', category: 'worship', label: 'Masjid',
    extraKey: 'religion', extraValue: 'muslim' },
  { key: 'amenity', value: 'place_of_worship', category: 'worship', label: 'Jain temple',
    extraKey: 'religion', extraValue: 'jain' },
  { key: 'amenity', value: 'place_of_worship', category: 'worship', label: 'Gurudwara',
    extraKey: 'religion', extraValue: 'sikh' },
  { key: 'amenity', value: 'place_of_worship', category: 'worship', label: 'Buddhist temple',
    extraKey: 'religion', extraValue: 'buddhist' },

  { key: 'amenity', value: 'atm',         category: 'money',      label: 'ATM' },
  { key: 'amenity', value: 'bank',        category: 'money',      label: 'Bank' },
  { key: 'amenity', value: 'bus_station', category: 'transport',  label: 'Bus station' },
  { key: 'amenity', value: 'police',      category: 'essentials', label: 'Police' },
  { key: 'amenity', value: 'toilets',     category: 'essentials', label: 'Toilets' },
  { key: 'amenity', value: 'fuel',        category: 'essentials', label: 'Fuel' },
];

export interface Poi {
  name: string;
  kind: string;
  category: PoiCategory;
  lat: number;
  lon: number;
  /** Metres from the station, straight line. */
  distance: number;
}

export type PoisByStation = Record<string, Poi[]>;

interface OverpassElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

export async function fetchPois(stations: Station[]): Promise<PoisByStation> {
  const collected = new Map<string, Poi>();

  for (const [i, tag] of TAGS.entries()) {
    if (i > 0) await sleep(GAP_MS);
    const extra = tag.extraKey ? `["${tag.extraKey}"="${tag.extraValue}"]` : '';
    const query =
      `[out:json][timeout:180];\nnwr["${tag.key}"="${tag.value}"]${extra}(${BBOX});\nout center tags;`;

    const elements = await runQuery(query);
    let kept = 0;
    for (const el of elements) {
      const pos = el.center ?? (el.lat != null && el.lon != null ? { lat: el.lat, lon: el.lon } : null);
      const tags = el.tags ?? {};
      const name = tags.name ?? tags['name:en'] ?? '';
      // Unnamed POIs are useless to someone trying to find a specific place.
      if (!pos || !name) continue;

      // Keyed by type+id: a hospital mapped as both node and way must not
      // appear twice, and ids are only unique within an element type.
      collected.set(`${el.type}/${el.id}/${tag.label}`, {
        name,
        kind: tag.label,
        category: tag.category,
        lat: pos.lat,
        lon: pos.lon,
        distance: 0,
      });
      kept++;
    }
    console.log(`  ${tag.label}: ${kept} named of ${elements.length}`);
  }

  // Assign each POI to every station it is within walking range of, then keep
  // only the closest few per category so the payload stays small.
  const byStation: PoisByStation = {};
  for (const station of stations) {
    const near: Poi[] = [];
    for (const poi of collected.values()) {
      const d = haversineMetres(station.lat, station.lon, poi.lat, poi.lon);
      if (d <= RADIUS_M) near.push({ ...poi, distance: Math.round(d) });
    }
    near.sort((a, b) => a.distance - b.distance);

    const perCategory = new Map<PoiCategory, number>();
    byStation[station.id] = near.filter((p) => {
      const n = perCategory.get(p.category) ?? 0;
      if (n >= PER_CATEGORY) return false;
      perCategory.set(p.category, n + 1);
      return true;
    });
  }
  return byStation;
}

async function runQuery(query: string): Promise<OverpassElement[]> {
  let lastError: unknown;
  for (const endpoint of ENDPOINTS) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'User-Agent': UA,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({ data: query }),
        });
        if (res.status === 429 || res.status === 504) {
          // Overpass asks busy clients to back off; respect it.
          await sleep(5000 * (attempt + 1));
          continue;
        }
        if (!res.ok) throw new Error(`Overpass ${res.status} ${res.statusText}`);
        const json = (await res.json()) as { elements?: OverpassElement[] };
        return json.elements ?? [];
      } catch (err) {
        lastError = err;
        await sleep(3000 * (attempt + 1));
      }
    }
  }
  throw new Error(
    `Overpass failed on all endpoints: ${lastError instanceof Error ? lastError.message : lastError}`,
  );
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function haversineMetres(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLon / 2) ** 2 * Math.cos(toRad(aLat)) * Math.cos(toRad(bLat));
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}
