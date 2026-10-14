/**
 * Scrapes BMRCL's official parking page.
 *
 * Note the page at english.bmrc.co.in is served in KANNADA regardless of
 * Accept-Language, so station names are matched via scripts/parking-aliases.json
 * rather than by comparing English text.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as cheerio from 'cheerio';
import type { StationParking } from '../types/transit';

const PARKING_URL = 'https://english.bmrc.co.in/parking/';
const here = dirname(fileURLToPath(import.meta.url));

interface AliasFile { map: Record<string, string> }

export interface ParkingResult {
  /** stop_id -> summed capacity across that station's lots. */
  byStation: Record<string, StationParking>;
  /** How many lots each station has, for the "3 lots" style UI hint. */
  lotCount: Record<string, number>;
}

export async function fetchParking(): Promise<ParkingResult> {
  const res = await fetch(PARKING_URL, {
    headers: { 'User-Agent': 'blr-transit data pipeline (+https://github.com)' },
  });
  if (!res.ok) throw new Error(`BMRCL parking page returned ${res.status}`);
  return parseParking(await res.text());
}

export function parseParking(html: string): ParkingResult {
  const aliases: AliasFile = JSON.parse(
    readFileSync(join(here, 'parking-aliases.json'), 'utf8'),
  );

  const $ = cheerio.load(html);
  const tables = $('table').toArray();
  if (tables.length < 2) {
    throw new Error(
      `BMRCL parking page structure changed: expected >=2 tables, found ${tables.length}. ` +
      'Re-check the page before trusting parking data.',
    );
  }

  // Table index 1 is "parking AT metro stations". Table 2 is "parking NEAR
  // stations" and partly duplicates table 1, so it is deliberately not used.
  const rows: string[][] = [];
  $(tables[1]).find('tr').each((_, tr) => {
    const cells = $(tr).find('td, th').toArray().map((td) => $(td).text().trim());
    // Data rows start with a serial number; headers and the title row do not.
    if (cells.length >= 6 && /^\d+$/.test(cells[0])) rows.push(cells);
  });

  if (rows.length === 0) {
    throw new Error('BMRCL parking page: found the table but parsed 0 data rows.');
  }

  const byStation: Record<string, StationParking> = {};
  const lotCount: Record<string, number> = {};
  const unmatched: string[] = [];

  for (const cells of rows) {
    const label = cells[1];
    const stationId = aliases.map[label];
    if (!stationId) { unmatched.push(label); continue; }

    const twoWheeler = toInt(cells[2]);
    const fourWheeler = toInt(cells[3]);
    const existing = byStation[stationId];
    // Stations such as Baiyappanahalli and Mysore Road have several lots.
    byStation[stationId] = existing
      ? { twoWheeler: existing.twoWheeler + twoWheeler,
          fourWheeler: existing.fourWheeler + fourWheeler }
      : { twoWheeler, fourWheeler };
    lotCount[stationId] = (lotCount[stationId] ?? 0) + 1;
  }

  if (unmatched.length) {
    throw new Error(
      `BMRCL parking page lists ${unmatched.length} lot(s) not in parking-aliases.json:\n` +
      unmatched.map((u) => `  - ${JSON.stringify(u)}`).join('\n') +
      '\nAdd them to scripts/parking-aliases.json (mapping to a GTFS stop_id).',
    );
  }
  return { byStation, lotCount };
}

function toInt(s: string): number {
  const n = Number.parseInt(s.replace(/[^\d]/g, ''), 10);
  return Number.isFinite(n) ? n : 0;
}
