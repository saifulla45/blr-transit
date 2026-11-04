'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { BusNetwork, DirectBus } from '@/types/transit';
import {
  findChangeJourneys, findDirectBuses, nearestStops, searchStops, stopsInLocality,
  type ChangeJourney, type NearbyStop,
} from '@/lib/journey';
import { BusIcon, PinIcon } from './icons';

/**
 * "I'm here, I want to get there — which bus?"
 *
 * The network index is ~1.5 MB, so it is fetched only when this panel is
 * actually used rather than on every page load.
 */
export function BusJourney({ lat, lon }: { lat: number; lon: number }) {
  const [network, setNetwork] = useState<BusNetwork | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  const [fromId, setFromId] = useState<string | null>(null);
  const [destQuery, setDestQuery] = useState('');
  const [dest, setDest] = useState<NearbyStop | null>(null);
  const [openPath, setOpenPath] = useState<string | null>(null);
  const started = useRef(false);
  const panelRef = useRef<HTMLElement | null>(null);

  /*
    Deferred until the panel is near the viewport.

    This used to be a bare useEffect on mount, which — despite the comment
    above claiming otherwise — fired the moment location was granted and
    pulled 2MB (406KB gzipped) before anyone had asked about a bus. On a
    patchy mobile connection that is the single most expensive thing the
    homepage did, and most visitors came for the metro and never scrolled
    this far.

    IntersectionObserver rather than a click: the panel's own content is the
    nearest stops, so it has to load before it can show anything useful.
    200px of rootMargin starts the fetch just before it scrolls into view, so
    the load is usually finished by the time it is read.
  */
  useEffect(() => {
    const node = panelRef.current;
    if (!node || started.current) return undefined;

    const load = () => {
      if (started.current) return;
      started.current = true;
      setLoading(true);
      fetch('/data/bus-network.json')
        .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
        .then((n: BusNetwork) => setNetwork(n))
        .catch(() => setFailed(true))
        .finally(() => setLoading(false));
    };

    // Safari 12 and some older Android browsers lack it; those just load now
    // rather than losing the feature.
    if (typeof IntersectionObserver === 'undefined') { load(); return undefined; }

    const observer = new IntersectionObserver(
      (entries) => { if (entries.some((e) => e.isIntersecting)) { load(); observer.disconnect(); } },
      { rootMargin: '200px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const near = useMemo(
    () => (network ? nearestStops(network, lat, lon, 5) : []),
    [network, lat, lon],
  );

  // Derived rather than stored: the closest stop is the default, and an explicit
  // choice overrides it. Defaulting via an effect would setState on every mount.
  const fromStop = near.find((s) => s.id === fromId) ?? near[0] ?? null;

  const destMatches = useMemo(
    /*
      Fifteen rather than eight, in a scrolling list. Three or four letters
      is how people actually search — "heb", "kora", "btm" — and that
      returns a genuine shortlist of real stops, which is far easier than
      guessing BMTC's exact spelling. Truncating it to a handful threw away
      the ones further down the alphabet for no reason.
    */
    () => (network && destQuery.trim() && !dest ? searchStops(network, destQuery, 15) : []),
    [network, destQuery, dest],
  );

  /*
    Matched by locality, not by exact stop name.

    Exact names reported "no direct bus" from Garudacharpalya to Hebbala
    while twelve routes ran it, because BMTC names the stops around one
    junction separately and those routes call at "Hebbala Bridge". Same
    search, same data, 0 results became 7.
  */
  const { buses, changes } = useMemo(() => {
    if (!network || !fromStop || !dest) return { buses: [] as DirectBus[], changes: [] as ChangeJourney[] };
    const fromIds = stopsInLocality(network, fromStop);
    const toIds = stopsInLocality(network, dest);
    const direct = findDirectBuses(network, fromIds, toIds);
    // Only worth computing when nothing runs the whole way.
    return {
      buses: direct,
      changes: direct.length === 0 ? findChangeJourneys(network, fromIds, toIds) : [],
    };
  }, [network, fromStop, dest]);

  if (failed) {
    return (
      <Shell panelRef={panelRef}>
        <p className="text-[0.8125rem]" style={{ color: 'var(--muted)' }}>
          Could not load the bus network. Reload to try again.
        </p>
      </Shell>
    );
  }

  // The ref has to be mounted in every state, or the observer has nothing to
  // watch and the fetch never starts.
  if (loading || !network) {
    return (
      <Shell panelRef={panelRef}>
        <p className="text-[0.8125rem]" style={{ color: 'var(--muted)' }}>
          {loading ? 'Loading the bus network…' : 'Bus routes load as this comes into view…'}
        </p>
      </Shell>
    );
  }

  return (
    <Shell panelRef={panelRef}>
      <div className="flex flex-col gap-3">
        {/* From */}
        <div>
          <label htmlFor="from-stop" className="eyebrow block pb-1.5">Board at</label>
          <select
            id="from-stop"
            value={fromStop?.id ?? ''}
            onChange={(e) => setFromId(e.target.value)}
            className="tap w-full px-3 text-[0.9375rem]"
            style={{
              borderRadius: 'var(--r-md)', background: 'var(--surface)',
              border: '1px solid var(--rule)', color: 'var(--ink)',
            }}
          >
            {near.length === 0 && <option value="">No bus stop within 1.2 km</option>}
            {near.map((s) => (
              <option key={s.id} value={s.id}>{s.name} · {s.distance} m</option>
            ))}
          </select>
        </div>

        {/* To */}
        <div>
          <label htmlFor="dest" className="eyebrow block pb-1.5">Going to</label>
          <input
            id="dest"
            type="search"
            value={dest ? dest.name : destQuery}
            onChange={(e) => { setDest(null); setDestQuery(e.target.value); }}
            placeholder="Search a stop — Majestic, Whitefield…"
            autoComplete="off"
            className="tap w-full px-3 text-[0.9375rem] outline-none"
            style={{
              borderRadius: 'var(--r-md)', background: 'var(--surface)',
              border: '1px solid var(--rule)', color: 'var(--ink)',
            }}
          />
          {destMatches.length > 0 && (
            <ul
              className="mt-1.5 overflow-y-auto"
              style={{
                borderRadius: 'var(--r-md)',
                border: '1px solid var(--rule)',
                // Roughly six rows before it scrolls, so a long list never
                // pushes the results off the screen.
                maxHeight: '17rem',
              }}
            >
              {destMatches.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => { setDest(s); setDestQuery(s.name); }}
                    className="tap w-full px-3 text-left text-[0.875rem]"
                    style={{ background: 'var(--surface)' }}
                  >
                    {s.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {dest && fromStop && (
        <div className="mt-5">
          {buses.length === 0 ? (
            /*
              "No direct bus" was a dead end, and in a city this size it is
              also the common answer. The useful next sentence is which two
              buses to take, so the change options are shown rather than
              described.
            */
            <>
              <p className="pb-3 text-[0.875rem]" style={{ color: 'var(--muted)' }}>
                No <strong>direct</strong> bus from {fromStop.name} to {dest.name}
                {changes.length > 0 ? ' — but you can get there with one change:' : '.'}
              </p>
              {changes.length > 0 && (
                <ul>
                  {changes.map((c) => (
                    <li
                      key={`${c.first.routeId}-${c.second.routeId}-${c.changeAt}`}
                      className="py-3"
                      style={{ borderTop: '1px solid var(--rule)' }}
                    >
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                        <RouteTag name={c.first.name} />
                        <span className="text-[0.75rem]" style={{ color: 'var(--muted)' }}>
                          {c.first.stopCount} stops
                        </span>
                        <span aria-hidden style={{ color: 'var(--muted)' }}>→</span>
                        <span className="text-[0.8125rem] font-medium">{c.changeAt}</span>
                        <span aria-hidden style={{ color: 'var(--muted)' }}>→</span>
                        <RouteTag name={c.second.name} />
                        <span className="text-[0.75rem]" style={{ color: 'var(--muted)' }}>
                          {c.second.stopCount} stops
                        </span>
                      </div>
                      <p className="pt-1 text-[0.75rem]" style={{ color: 'var(--muted)' }}>
                        Change at <strong>{c.changeAt}</strong> · {c.totalStops} stops in total
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <>
              <p className="eyebrow pb-2">
                {buses.length} direct bus{buses.length > 1 ? 'es' : ''} · {fromStop.name} → {dest.name}
              </p>
              <ul>
                {buses.map((b) => (
                  <li key={b.routeId} className="py-3" style={{ borderTop: '1px solid var(--rule)' }}>
                    <div className="flex items-baseline gap-2">
                      <span
                        className="num shrink-0 px-1.5 py-px text-[0.8125rem] font-semibold"
                        style={{
                          fontVariantNumeric: 'tabular-nums',
                          borderRadius: 'var(--r-sm)',
                          background: 'var(--accent)',
                          color: 'var(--on-accent)',
                        }}
                      >
                        {b.name}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[0.875rem]">{b.long}</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setOpenPath(openPath === b.routeId ? null : b.routeId)}
                      className="num mt-1.5 text-[0.75rem] underline decoration-dotted underline-offset-2"
                      style={{ color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}
                      aria-expanded={openPath === b.routeId}
                    >
                      {b.stopCount} stops · {openPath === b.routeId ? 'hide route' : 'show route'}
                    </button>

                    {openPath === b.routeId && (
                      <ol className="mt-2 flex flex-col gap-1 text-[0.8125rem]">
                        {b.path.map((name, i) => (
                          <li key={i} className="flex items-baseline gap-2">
                            <span
                              className="num shrink-0 text-[0.6875rem]"
                              style={{ color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}
                            >
                              {String(i + 1).padStart(2, '0')}
                            </span>
                            <span
                              className={i === 0 || i === b.path.length - 1 ? 'font-semibold' : ''}
                              style={{ color: i === 0 || i === b.path.length - 1 ? 'var(--ink)' : 'var(--muted)' }}
                            >
                              {name}
                            </span>
                          </li>
                        ))}
                      </ol>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      <p className="pt-4 text-[0.75rem] leading-relaxed" style={{ color: 'var(--muted)' }}>
        Direct routes only — journeys needing a change of bus are not shown. BMTC data is
        community-scraped and its timetables are unreliable, so routes are accurate but times
        are not.
      </p>
    </Shell>
  );
}

function Shell({
  children, panelRef,
}: {
  children: React.ReactNode;
  panelRef?: React.Ref<HTMLElement>;
}) {
  return (
    <section ref={panelRef} className="card p-4 md:p-5">
      <div className="flex items-center gap-3 pb-3.5">
        <span className="chip-grad h-9 w-9 shrink-0"
          style={{ ['--chip-a' as string]: '#1f8a7e', ['--chip-b' as string]: '#0f6b62' }}>
          <BusIcon size={17} />
        </span>
        <div>
          <p className="eyebrow">BMTC</p>
          <h2 className="text-[1.125rem] font-semibold leading-tight tracking-[-0.02em]">Which bus goes there</h2>
        </div>
      </div>
      <div>{children}</div>
    </section>
  );
}

export { PinIcon };

/** The route number, styled as the board on the front of the bus. */
function RouteTag({ name }: { name: string }) {
  return (
    <span
      className="num shrink-0 px-1.5 py-px text-[0.8125rem] font-semibold"
      style={{
        fontVariantNumeric: 'tabular-nums',
        borderRadius: 'var(--r-sm)',
        background: 'var(--accent)',
        color: 'var(--on-accent)',
      }}
    >
      {name}
    </span>
  );
}
