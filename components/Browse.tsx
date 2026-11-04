'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import {
  toLite,
  type CalendarOverrides, type FareWindows, type Line, type LineId, type NetworkStatus,
  type Station,
} from '@/types/transit';
import { nearestStations, SERVICE_RADIUS_KM } from '@/lib/geo';
import type { LiveNetwork as Net } from '@/lib/livePositions';
import { nowInBengaluru } from '@/lib/time';
import { useLocation } from '@/lib/useLocation';
import { BusJourney } from './BusJourney';
import { LastMile } from './LastMile';
import { CinematicNetwork } from './CinematicNetwork';
import { SmoothScroll } from './SmoothScroll';
import { OutOfArea } from './OutOfArea';
import { MetroPlanner } from './MetroPlanner';
import { SavedStations } from './SavedStations';
import { Hero } from './Hero';
import { StationGroup, StationRow } from './StationRow';
import { UnifiedSearch } from './UnifiedSearch';
import { lineVar } from './primitives';
import { matchByName } from '@/lib/search';

type Filter = LineId | 'ALL';

// Enough to show the list's shape; the rest is one tap away.
const PREVIEW_COUNT = 8;

/**
 * Everything below the hero: locate, search, filter by line, browse all 83.
 * Before this the page was empty until you granted location — now it has
 * something to do either way.
 */
export function Browse({
  stations, lines, network, overrides, fareWindows, live,
}: {
  stations: Station[]; lines: Line[]; network: NetworkStatus; overrides: CalendarOverrides;
  fareWindows: FareWindows;
  live: Net;
}) {
  const { state, request } = useLocation();
  const [q] = useState('');
  const [filter, setFilter] = useState<Filter>('ALL');
  const [expanded, setExpanded] = useState(false);

  /*
    Same null-until-mounted pattern as the departure boards: the server has no
    clock in Bengaluru's timezone that agrees with the client's, so anything
    derived from "now" has to arrive after hydration or the markup mismatches.
    Only used for the 10pm night tariff, hence the lazy minute tick.
  */
  const [now, setNow] = useState<ReturnType<typeof nowInBengaluru> | null>(null);
  useEffect(() => {
    const tick = () => setNow(nowInBengaluru());
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

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
          className="btn-primary press tap text-[0.9375rem] sm:w-auto sm:shrink-0"
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
      {/* Inertial scrolling, landing page only — it is the clock the
          scroll-scrubbed drawing below rides on. */}
      <SmoothScroll />

      <Hero network={network} overrides={overrides}>{controls}</Hero>


      {/* Results sit on the page ground, not on the photograph. */}
      {/* min-w-0 throughout: grid items default to min-width:auto, so a long
          station row would otherwise refuse to shrink and overflow the page
          horizontally on narrow screens. */}
      <div className="mx-auto grid w-full max-w-[64rem] gap-8 px-5 pt-2 md:grid-cols-2 md:gap-x-8 md:px-8 md:pt-4">
        <SavedStations stations={stations} lines={lines} />

        {state.status === 'ready' && outOfArea && (
          <OutOfArea nearestStationKm={nearest[0].distanceKm} />
        )}

        {/*
          "How do I actually get there" — shown whenever we know where you
          are, not only when the station is far.

          This was gated on distance > 1km, which sounded reasonable and was
          wrong in practice: most people near a metro are WITHIN a kilometre
          of it, so the fares were invisible to exactly the people who open
          this standing next to a station and want to know what an auto
          should cost. The card adapts its framing instead of disappearing.

          Keyed on the nearest station only — offering rides to the
          second-nearest is noise. Waits for `now` because the night tariff
          needs a clock.
        */}
        {state.status === 'ready' && !outOfArea && now && nearest.length > 0 && (
          <section className="min-w-0 md:col-span-2">
            <LastMile
              station={nearest[0].item}
              distanceKm={nearest[0].distanceKm}
              minutesSinceMidnight={now.minutes}
              from={state.coords}
            />
          </section>
        )}

        {state.status === 'ready' && !outOfArea && nearest.length > 1 && (
          <section className="stop-in min-w-0 md:col-span-2">
            <p className="eyebrow">{state.stale ? 'Last known location' : 'Around you'}</p>
            <h2 className="section-title mt-1 pb-3">Other stations nearby</h2>
            <StationGroup>
              {nearest.slice(1).map(({ item, distanceKm }) => (
                <StationRow key={item.id} station={item} lines={lines} distanceKm={distanceKm} grouped />
              ))}
            </StationGroup>
          </section>
        )}

        {/* Metro A-to-B from the home page: buses already answered this here,
            and making people open a station page first was an odd asymmetry. */}
        {/* useSearchParams bails out of prerendering without a boundary;
            the station page wraps its planner for the same reason. */}
        <Suspense fallback={null}>
          <MetroPlanner
            stations={stationsLite}
            lines={lines}
            fareWindows={fareWindows}
            overrides={overrides}
          />
        </Suspense>

        {/* Buses are the other half of "how do I get there from here", so the
            journey search sits right under the nearest stations rather than
            being buried on a station page. */}
        {state.status === 'ready' && !outOfArea && (
          <section className="min-w-0 md:col-span-2">
            <BusJourney lat={state.coords.lat} lon={state.coords.lon} />
          </section>
        )}

      </div>

      {/* The one place where scrolling is the content. After the tasks, so
          someone who opened the site to find a train is never made to
          scroll through a showpiece first. */}
      <div className="mt-12">
        <CinematicNetwork net={live} overrides={overrides} />
      </div>

      <div className="mx-auto grid w-full max-w-[64rem] gap-8 px-5 pt-10 md:px-8">
        <section className="min-w-0">
          <div className="flex flex-wrap items-end justify-between gap-2 pb-3">
            <div>
              <p className="eyebrow">Browse</p>
              <h2 className="section-title mt-1">
                {q.trim() ? `${listed.length} matching` : 'All stations'}
              </h2>
            </div>
            <span className="num rounded-full px-2.5 py-1 text-[0.6875rem] font-semibold"
              style={{ color: 'var(--muted)', background: 'var(--surface)', border: '1px solid var(--rule)' }}>
              {listed.length} of {stations.length}
            </span>
          </div>

          <div className="scroll-x fade-x -mx-5 flex gap-2 px-5 pb-3 md:mx-0 md:px-0" role="group" aria-label="Filter by line">
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
            <>
              <StationGroup>
                {(expanded ? listed : listed.slice(0, PREVIEW_COUNT)).map((s) => (
                  <StationRow key={s.id} station={s} lines={lines} grouped />
                ))}
              </StationGroup>
              {listed.length > PREVIEW_COUNT && (
                <button
                  type="button"
                  onClick={() => setExpanded((v) => !v)}
                  aria-expanded={expanded}
                  className="btn-ghost press tap mt-3 w-full text-[0.875rem]"
                >
                  {expanded ? 'Show fewer' : `Show all ${listed.length} stations`}
                </button>
              )}
            </>
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
      className="press flex shrink-0 items-center gap-2 whitespace-nowrap px-3.5 py-2 text-[0.8125rem] font-semibold"
      style={{
        borderRadius: 999,
        background: active ? 'var(--brand-gradient)' : 'var(--surface)',
        color: active ? '#ffffff' : 'var(--muted)',
        border: `1px solid ${active ? 'transparent' : 'var(--rule)'}`,
        boxShadow: active ? 'var(--glow)' : 'none',
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
