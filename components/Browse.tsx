'use client';

import { useMemo, useState } from 'react';
import {
  toLite,
  type CalendarOverrides, type FareWindows, type Line, type LineId, type NetworkStatus,
  type Station,
} from '@/types/transit';
import { nearestStations, SERVICE_RADIUS_KM } from '@/lib/geo';
import { useLocation } from '@/lib/useLocation';
import { BusJourney } from './BusJourney';
import { MetroPlanner } from './MetroPlanner';
import { RecentStations } from './RecentStations';
import { SavedStations } from './SavedStations';
import { Hero } from './Hero';
import { StationRow } from './StationRow';
import { UnifiedSearch } from './UnifiedSearch';
import { lineVar } from './primitives';
import { matchByName } from '@/lib/search';

type Filter = LineId | 'ALL';

/**
 * Everything below the hero: locate, search, filter by line, browse all 83.
 * Before this the page was empty until you granted location — now it has
 * something to do either way.
 */
export function Browse({
  stations, lines, network, overrides, stats, fareWindows,
}: {
  stations: Station[]; lines: Line[]; network: NetworkStatus; overrides: CalendarOverrides;
  stats: Array<{ value: string; label: string }>; fareWindows: FareWindows;
}) {
  const { state, request } = useLocation();
  const [q] = useState('');
  const [filter, setFilter] = useState<Filter>('ALL');

  const nearest = state.status === 'ready'
    ? nearestStations(state.coords.lat, state.coords.lon, stations, 4)
    : [];
  // Outside Bengaluru the distances are real but meaningless — someone opening
  // this from another city was told the nearest station was 1,700 km away.
  const outOfArea = nearest.length > 0 && nearest[0].distanceKm > SERVICE_RADIUS_KM;

  // Transliteration-aware, so "yesvan" still finds Yeshwantpur.
  // Same lean projection as the station page, for the same reason.
  const stationsLite = useMemo(() => stations.map(toLite), [stations]);

  const listed = useMemo(() => {
    const byLine = stations.filter((s) => filter === 'ALL' || s.lines.includes(filter));
    return q.trim() ? matchByName(byLine, q, byLine.length) : byLine;
  }, [stations, q, filter]);

  const controls = (
    <>
      <div className="flex flex-col gap-2.5 sm:flex-row">
        <button
          type="button"
          onClick={request}
          disabled={state.status === 'locating'}
          className="tap flex min-h-[48px] items-center justify-center gap-2 px-5 text-[0.9375rem] font-semibold transition-opacity disabled:opacity-60 sm:w-auto sm:shrink-0"
          style={{
            borderRadius: 'var(--r-md)',
            background: 'var(--accent)',
            color: 'var(--on-accent)',
            boxShadow: '0 0 28px rgba(194,100,216,.40)',
          }}
        >
          <Pin />
          {/*
            Keyed off a LIVE fix, not a cached one. A cached location always
            arrives with stale:true, so the server render and the first client
            render agree and the label no longer flips on refresh — the server
            cannot see localStorage, so anything derived from it flashes.
          */}
          {state.status === 'locating' ? 'Finding you…'
            : state.status === 'ready' && !state.stale ? 'Update location'
            : 'Find my nearest station'}
        </button>

        <div className="relative flex-1">
          {/* One box for stations, bus stops and places — they were three
              separate searches in three places before. */}
          <UnifiedSearch stations={stations} lines={lines} />
        </div>
      </div>

      {state.status === 'error' && (
        /*
         * Deliberately loud. This previously rendered as 13px muted grey, which
         * on a phone is indistinguishable from the button doing nothing — the
         * commonest report was "I tap it and nothing happens" when in fact the
         * browser had refused and said so, quietly.
         */
        <div
          role="alert"
          className="mt-3 flex gap-2.5 p-3"
          style={{
            borderRadius: 'var(--r-md)',
            background: 'color-mix(in srgb, var(--warn) 14%, transparent)',
            border: '1px solid color-mix(in srgb, var(--warn) 45%, transparent)',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden
            className="mt-px shrink-0" style={{ color: 'var(--warn)' }}>
            <circle cx="12" cy="12" r="9" /><path d="M12 7.5v5M12 16h.01" />
          </svg>
          <div className="min-w-0 text-[0.8125rem] leading-relaxed">
            <p className="font-semibold" style={{ color: 'var(--warn)' }}>
              {state.reason === 'insecure' ? 'This page is not secure'
                : state.reason === 'denied' ? 'Location is blocked for this site'
                : state.reason === 'timeout' ? 'That took too long'
                : state.reason === 'unsupported' ? 'This browser cannot share a location'
                : 'Location is unavailable'}
            </p>
            <p className="mt-1" style={{ color: 'var(--ink)' }}>
              {state.reason === 'insecure'
                ? 'Browsers only share a location over https. Open the site on its secure address.'
                : state.reason === 'denied'
                ? 'Your browser has already refused, so it will not ask again until you allow it.'
                : state.reason === 'timeout'
                ? 'Your device did not return a position in time.'
                : state.reason === 'unsupported'
                ? 'You can still search or browse every station below.'
                : 'Your device may have location services switched off.'}
            </p>
            {(state.reason === 'denied' || state.reason === 'unavailable') && (
              <ul className="mt-2 flex list-disc flex-col gap-0.5 pl-4" style={{ color: 'var(--muted)' }}>
                <li>
                  <strong>iPhone:</strong> Settings → Privacy &amp; Security → Location Services →
                  Safari Websites → While Using the App. Then reload this page.
                </li>
                <li>
                  <strong>Chrome / desktop:</strong> tap the icon beside the address bar → Location
                  → Allow.
                </li>
              </ul>
            )}
            <p className="mt-2" style={{ color: 'var(--muted)' }}>
              You can search or browse all 83 stations below without sharing a location.
            </p>
          </div>
        </div>
      )}
    </>
  );

  return (
    <>
      <Hero network={network} overrides={overrides} stats={stats}>{controls}</Hero>

      {/* Results sit on the page ground, not on the photograph. */}
      {/* min-w-0 throughout: grid items default to min-width:auto, so a long
          station row would otherwise refuse to shrink and overflow the page
          horizontally on narrow screens. */}
      <div className="mx-auto grid w-full max-w-[64rem] gap-9 px-5 pt-9 md:grid-cols-2 md:gap-x-10 md:px-8 md:pt-11">
        <SavedStations stations={stations} lines={lines} />
        <RecentStations stations={stations} lines={lines} />

        {state.status === 'ready' && outOfArea && (
          <section className="stop-in min-w-0 md:col-span-2">
            <div
              className="flex gap-2.5 p-3"
              style={{
                borderRadius: 'var(--r-md)',
                background: 'color-mix(in srgb, var(--warn) 14%, transparent)',
                border: '1px solid color-mix(in srgb, var(--warn) 45%, transparent)',
              }}
            >
              <div className="text-[0.8125rem] leading-relaxed">
                <p className="font-semibold" style={{ color: 'var(--warn)' }}>
                  You don&rsquo;t appear to be in Bengaluru
                </p>
                <p className="mt-1" style={{ color: 'var(--ink)' }}>
                  The closest station is {Math.round(nearest[0].distanceKm)} km away. Search or
                  browse the network below instead.
                </p>
              </div>
            </div>
          </section>
        )}

        {state.status === 'ready' && !outOfArea && (
          <section className="stop-in min-w-0 md:col-span-2">
            <h2 className="eyebrow pb-1">
              Nearest to you{state.stale ? ' · last known location' : ''}
            </h2>
            <div className="min-w-0 md:grid md:grid-cols-2 md:gap-x-10">
              {nearest.map(({ item, distanceKm }) => (
                <StationRow key={item.id} station={item} lines={lines} distanceKm={distanceKm} />
              ))}
            </div>
          </section>
        )}

        {/* Metro A-to-B from the home page: buses already answered this here,
            and making people open a station page first was an odd asymmetry. */}
        <MetroPlanner
          stations={stationsLite}
          lines={lines}
          fareWindows={fareWindows}
          overrides={overrides}
        />

        {/* Buses are the other half of "how do I get there from here", so the
            journey search sits right under the nearest stations rather than
            being buried on a station page. */}
        {state.status === 'ready' && (
          <section className="min-w-0 md:col-span-2">
            <BusJourney lat={state.coords.lat} lon={state.coords.lon} />
          </section>
        )}

        <section className="min-w-0 md:col-span-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2 pb-2">
            <h2 className="eyebrow">
              {q.trim() ? `${listed.length} matching` : 'All stations'}
            </h2>
            <span className="eyebrow" style={{ color: 'var(--muted)' }}>
              {listed.length} of {stations.length}
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5 pb-1" role="group" aria-label="Filter by line">
            <FilterChip active={filter === 'ALL'} onClick={() => setFilter('ALL')} label="All lines" />
            {lines.map((l) => (
              <FilterChip
                key={l.id}
                active={filter === l.id}
                onClick={() => setFilter(l.id)}
                label={l.name}
                color={lineVar(l.id)}
              />
            ))}
          </div>

          {listed.length === 0 ? (
            <p className="py-6 text-[0.875rem]" style={{ color: 'var(--muted)' }}>
              No station matches “{q.trim()}”{filter !== 'ALL' ? ' on that line' : ''}.
            </p>
          ) : (
            <div className="min-w-0 md:grid md:grid-cols-2 md:gap-x-10">
              {listed.map((s) => <StationRow key={s.id} station={s} lines={lines} />)}
            </div>
          )}
        </section>
      </div>
    </>
  );
}

function FilterChip({
  active, onClick, label, color,
}: { active: boolean; onClick: () => void; label: string; color?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="flex items-center gap-1.5 px-3 py-1.5 text-[0.8125rem] font-medium transition-colors"
      style={{
        borderRadius: 'var(--r-md)',
        background: active ? 'var(--ink)' : 'var(--surface)',
        color: active ? 'var(--ground)' : 'var(--muted)',
      }}
    >
      {color && (
        <span className="h-2 w-2 rounded-full" style={{ background: color }} aria-hidden />
      )}
      {label}
    </button>
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
