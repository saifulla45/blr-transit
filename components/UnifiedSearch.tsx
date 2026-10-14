'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { BusNetwork, Line, Poi, PoisByStation, Station } from '@/types/transit';
import { matchByName } from '@/lib/search';
import { BusIcon, IconForKind, TrainIcon } from './icons';
import { LineTag } from './primitives';

type Hit =
  | { kind: 'station'; station: Station }
  | { kind: 'stop'; name: string; lat: number; lon: number }
  | { kind: 'place'; poi: Poi; stationId: string };

/**
 * One box for stations, bus stops and places.
 *
 * These were three separate searches in three parts of the app, which meant
 * knowing in advance which kind of thing you were looking for. Stations match
 * instantly from memory; the bus and place indexes are ~2 MB and ~320 KB, so
 * they load in the background on first use rather than on page load.
 */
export function UnifiedSearch({ stations, lines }: { stations: Station[]; lines: Line[] }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [extra, setExtra] = useState<{ bus: BusNetwork; pois: PoisByStation } | null>(null);
  const started = useRef(false);

  const loadExtras = useCallback(() => {
    if (started.current) return;
    started.current = true;
    Promise.all([
      fetch('/data/bus-network.json').then((r) => r.json()),
      fetch('/data/pois.json').then((r) => r.json()),
    ])
      .then(([bus, pois]) => setExtra({ bus, pois }))
      .catch(() => setExtra(null));
  }, []);

  const hits = useMemo<Hit[]>(() => {
    if (q.trim().length < 2) return [];

    const out: Hit[] = matchByName(stations, q, 5).map((station) => ({ kind: 'station', station }));

    if (extra) {
      // De-duplicate bus stops by name: every stop exists once per direction.
      const seen = new Set<string>();
      const stops = Object.values(extra.bus.stops).filter((s) => {
        const k = s.name.toLowerCase();
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
      for (const s of matchByName(stops, q, 3)) {
        out.push({ kind: 'stop', name: s.name, lat: s.lat, lon: s.lon });
      }

      const places: Array<Poi & { stationId: string }> = [];
      for (const [stationId, list] of Object.entries(extra.pois)) {
        for (const p of list) places.push({ ...p, stationId });
      }
      const placeSeen = new Set<string>();
      for (const p of matchByName(places, q, 4)) {
        if (placeSeen.has(p.name)) continue;
        placeSeen.add(p.name);
        out.push({ kind: 'place', poi: p, stationId: p.stationId });
      }
    }

    return out;
  }, [q, stations, extra]);

  return (
    <div className="relative">
      <label htmlFor="unified" className="sr-only">Search stations, bus stops and places</label>
      <input
        id="unified"
        type="search"
        value={q}
        onFocus={loadExtras}
        onChange={(e) => { setQ(e.target.value); loadExtras(); }}
        placeholder="Search stations, bus stops, places…"
        autoComplete="off"
        className="tap w-full px-3.5 text-[0.9375rem] outline-none"
        style={{
          borderRadius: 'var(--r-md)',
          background: 'var(--surface)',
          border: '1px solid var(--rule)',
          color: 'var(--ink)',
        }}
      />

      {q.trim().length >= 2 && (
        <div
          className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden"
          style={{
            borderRadius: 'var(--r-md)',
            background: 'var(--raised)',
            border: '1px solid var(--rule)',
            boxShadow: '0 16px 40px rgba(0,0,0,.45)',
          }}
        >
          {hits.length === 0 ? (
            <p className="px-3 py-2.5 text-[0.8125rem]" style={{ color: 'var(--muted)' }}>
              {extra ? `Nothing matches “${q.trim()}”.` : 'Searching…'}
            </p>
          ) : (
            <ul>
              {hits.map((h, i) => (
                <li key={i}>
                  {h.kind === 'station' ? (
                    <button
                      type="button"
                      onClick={() => router.push(`/station/${h.station.id}`)}
                      className="tap flex w-full items-center justify-between gap-2 px-3 text-left"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span style={{ color: 'var(--accent)' }}><TrainIcon size={15} /></span>
                        <span className="truncate text-[0.875rem]">{h.station.name}</span>
                      </span>
                      <span className="flex shrink-0 gap-1">
                        {h.station.lines.map((l) => <LineTag key={l} line={l} lines={lines} />)}
                      </span>
                    </button>
                  ) : h.kind === 'stop' ? (
                    <a
                      href={`https://www.openstreetmap.org/?mlat=${h.lat}&mlon=${h.lon}#map=18/${h.lat}/${h.lon}`}
                      target="_blank"
                      rel="noreferrer"
                      className="tap flex w-full items-center justify-between gap-2 px-3 text-left"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span style={{ color: 'var(--muted)' }}><BusIcon size={15} /></span>
                        <span className="truncate text-[0.875rem]">{h.name}</span>
                      </span>
                      <span className="eyebrow shrink-0">Bus stop</span>
                    </a>
                  ) : (
                    <button
                      type="button"
                      onClick={() => router.push(`/station/${h.stationId}#nearby`)}
                      className="tap flex w-full items-center justify-between gap-2 px-3 text-left"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span style={{ color: 'var(--muted)' }}>
                          <IconForKind kind={h.poi.kind} size={15} />
                        </span>
                        <span className="truncate text-[0.875rem]">{h.poi.name}</span>
                      </span>
                      <span className="eyebrow shrink-0">{h.poi.kind}</span>
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
