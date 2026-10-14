/** Minimal GTFS reader: fetches the feed zip and parses the tables we need. */
import AdmZip from 'adm-zip';

const FEED_URL = 'https://raw.githubusercontent.com/Vonter/bmrcl-gtfs/main/gtfs/bmrcl.zip';
const COMMIT_API = 'https://api.github.com/repos/Vonter/bmrcl-gtfs/commits?path=gtfs/bmrcl.zip&per_page=1';

export type Row = Record<string, string>;

/**
 * RFC4180-ish CSV parser. GTFS quotes fields containing commas
 * (route_desc does), so a naive split(',') corrupts those rows.
 */
export function parseCsv(text: string): Row[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else quoted = false;
      } else field += c;
      continue;
    }
    if (c === '"') { quoted = true; continue; }
    if (c === ',') { row.push(field); field = ''; continue; }
    if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
      continue;
    }
    field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }

  const header = rows.shift();
  if (!header) return [];
  // Strip a UTF-8 BOM if the publisher left one on the first header cell.
  header[0] = header[0].replace(/^﻿/, '');

  return rows.map((r) => {
    const o: Row = {};
    header.forEach((h, i) => { o[h] = (r[i] ?? '').trim(); });
    return o;
  });
}

export interface Feed {
  tables: Record<string, Row[]>;
  sourceCommit: string;
}

export async function fetchFeed(): Promise<Feed> {
  const [zipRes, commit] = await Promise.all([
    fetch(FEED_URL),
    fetchSourceCommit(),
  ]);
  if (!zipRes.ok) {
    throw new Error(`Failed to download GTFS feed: ${zipRes.status} ${zipRes.statusText}`);
  }
  const buf = Buffer.from(await zipRes.arrayBuffer());
  const zip = new AdmZip(buf);

  const tables: Record<string, Row[]> = {};
  for (const entry of zip.getEntries()) {
    if (!entry.entryName.endsWith('.txt')) continue;
    const name = entry.entryName.replace(/\.txt$/, '');
    tables[name] = parseCsv(entry.getData().toString('utf8'));
  }
  return { tables, sourceCommit: commit };
}

/** Records which upstream commit produced this data, so staleness is traceable. */
async function fetchSourceCommit(): Promise<string> {
  try {
    const res = await fetch(COMMIT_API, {
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!res.ok) return 'unknown';
    const json = (await res.json()) as Array<{ sha?: string }>;
    return json[0]?.sha?.slice(0, 10) ?? 'unknown';
  } catch {
    // The feed itself is what matters; a missing commit ref must not fail the build.
    return 'unknown';
  }
}

/**
 * GTFS "HH:MM:SS" -> minutes since midnight.
 * Hours can exceed 24 for past-midnight service, which is why this is not a Date.
 */
export function toMinutes(hhmmss: string): number {
  const parts = hhmmss.split(':');
  if (parts.length < 2) throw new Error(`Malformed GTFS time: "${hhmmss}"`);
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  const s = Number(parts[2] ?? '0');
  if (!Number.isFinite(h) || !Number.isFinite(m) || !Number.isFinite(s)) {
    throw new Error(`Malformed GTFS time: "${hhmmss}"`);
  }
  // Round to the nearest minute: these times are interpolated (timepoint=0),
  // so second-level precision would imply accuracy the feed does not have.
  return h * 60 + m + Math.round(s / 60);
}
