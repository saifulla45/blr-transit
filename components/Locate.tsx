'use client';

import { useMemo, useState } from 'react';
import type { Line, Station } from '@/types/transit';
import { nearestStations } from '@/lib/geo';
import { useLocation } from '@/lib/useLocation';
import { StationRow } from './StationRow';

export function Locate({ stations, lines }: { stations: Station[]; lines: Line[] }) {
  const { state, request } = useLocation();
  const [q, setQ] = useState('');

  const nearest = state.status === 'ready'
    ? nearestStations(state.coords.lat, state.coords.lon, stations, 3)
    : [];

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return [];
    return stations.filter((s) => s.name.toLowerCase().includes(needle)).slice(0, 10);
  }, [q, stations]);

  const searching = q.trim().length > 0;

  return (
    <div>
      <button
        type="button"
        onClick={request}
        disabled={state.status === 'locating'}
        className="tap flex w-full items-center justify-center gap-2 px-4 text-[0.9375rem] font-semibold disabled:opacity-60"
        style={{
          borderRadius: 'var(--r-md)',
          background: 'var(--accent)',
          color: 'var(--on-accent)',
        }}
      >
        <Pin />
        {state.status === 'locating' ? 'Finding you…'
          : state.status === 'ready' ? 'Update my location'
          : 'Find my nearest station'}
      </button>

      {state.status === 'error' && (
        <p className="mt-3 text-[0.8125rem]" style={{ color: 'var(--muted)' }}>
          {state.reason === 'denied'
            ? 'Location is switched off for this site. Search for your station below instead.'
            : state.reason === 'timeout'
            ? 'That took too long. Try again, or search below.'
            : state.reason === 'unsupported'
            ? 'This browser cannot share a location. Search below instead.'
            : 'Location is unavailable right now. Search below instead.'}
        </p>
      )}

      {!searching && state.status === 'ready' && (
        <section className="mt-7">
          <h2 className="eyebrow pb-1">
            Nearest {state.stale ? '· from your last known location' : ''}
          </h2>
          {nearest.map(({ item, distanceKm }) => (
            <StationRow key={item.id} station={item} lines={lines} distanceKm={distanceKm} />
          ))}
        </section>
      )}

      <section className="mt-7">
        <label htmlFor="q" className="eyebrow block pb-2">
          {state.status === 'ready' ? 'Or find another station' : 'Find a station'}
        </label>
        <input
          id="q"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Indiranagar, Majestic, Whitefield…"
          autoComplete="off"
          className="tap w-full px-3 text-[0.9375rem] outline-none"
          style={{
            borderRadius: 'var(--r-md)',
            background: 'var(--surface)',
            border: '1px solid var(--rule)',
            color: 'var(--ink)',
          }}
        />

        {searching && (
          results.length > 0 ? (
            <div className="mt-3">
              {results.map((s) => <StationRow key={s.id} station={s} lines={lines} />)}
            </div>
          ) : (
            <p className="mt-3 text-[0.8125rem]" style={{ color: 'var(--muted)' }}>
              No station matches “{q.trim()}”.
            </p>
          )
        )}
      </section>
    </div>
  );
}

function Pin() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}
