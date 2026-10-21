'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type {
  CalendarOverrides, FareWindows, JourneyMatrix, Line, StationLite,
} from '@/types/transit';
import {
  WHATSAPP_TICKET_URL, fareOptions, formatRupees, isPeak, type FareTuple,
} from '@/lib/fares';
import { nowInBengaluru, servicePatternFor } from '@/lib/time';
import { InterchangeIcon, TicketIcon, WhatsAppIcon } from './icons';
import { JourneyPath } from './JourneyPath';
import { StationPicker } from './StationPicker';

/**
 * Plan a metro trip from the home page.
 *
 * Buses already answered "A to B" from here; metro made you open a station page
 * first, which is an odd asymmetry for the thing the app is mostly about.
 *
 * The fare and journey matrices are ~70 KB and ~1 MB, so they load only when
 * this is actually used.
 */
export function MetroPlanner({
  stations, lines, fareWindows, overrides,
}: {
  stations: StationLite[];
  lines: Line[];
  fareWindows: FareWindows;
  overrides: CalendarOverrides;
}) {
  /*
    From and to live in the URL, like the station page's planner already did.
    A planned route survives a reload and can be sent to someone — "here is
    your way home" is a message people actually send, and it was impossible
    from the home page because the whole journey was local component state.
  */
  const router = useRouter();
  const params = useSearchParams();
  const byId = (id: string | null) => stations.find((s) => s.id === id) ?? null;

  const [from, setFrom] = useState<StationLite | null>(() => byId(params.get('from')));
  const [to, setTo] = useState<StationLite | null>(() => byId(params.get('to')));

  // replace, not push: changing endpoints should not fill the back stack.
  const syncUrl = useCallback((f: StationLite | null, t: StationLite | null) => {
    const q = new URLSearchParams();
    if (f) q.set('from', f.id);
    if (t) q.set('to', t.id);
    const qs = q.toString();
    router.replace(qs ? `/?${qs}#plan` : '/', { scroll: false });
  }, [router]);
  const [data, setData] = useState<{
    fares: Record<string, Record<string, FareTuple>>;
    journeys: JourneyMatrix;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState<ReturnType<typeof nowInBengaluru> | null>(null);

  useEffect(() => {
    const tick = () => setNow(nowInBengaluru());
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  // Kicked off from the picker's change handler rather than an effect: this is
  // a response to an interaction, and doing it in an effect means setState
  // during render commit.
  const started = useRef(false);
  const ensureData = useCallback(() => {
    if (started.current) return;
    started.current = true;
    setLoading(true);
    Promise.all([
      fetch('/data/fares.json').then((r) => r.json()),
      fetch('/data/journeys.json').then((r) => r.json()),
    ])
      .then(([fares, journeys]) => setData({ fares, journeys }))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  const fare = from && to ? data?.fares?.[from.id]?.[to.id] : undefined;
  const journey = from && to ? data?.journeys?.[from.id]?.[to.id] : undefined;
  const pattern = now ? servicePatternFor(now.date, overrides, now.weekday) : null;
  const peak = now && pattern ? isPeak(fareWindows, pattern, now.minutes) : false;

  /*
    A shared link arrives with endpoints already set, but nothing has tapped
    a picker, so the fare and journey matrices were never fetched and the
    page showed two filled boxes and no answer.
  */
  useEffect(() => {
    if (from || to) ensureData();
    // Intentionally mount-only: later changes go through the pickers, which
    // call ensureData themselves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section id="plan" className="min-w-0 scroll-mt-4 md:col-span-2">
      <h2 className="eyebrow flex items-center gap-1.5 pb-2">
        <TicketIcon size={14} /> Plan a metro trip
      </h2>

      <div className="grid gap-2.5 sm:grid-cols-2">
        <StationPicker
          stations={stations.filter((s) => s.id !== to?.id)}
          lines={lines}
          value={from}
          onSelect={(s) => { setFrom(s); syncUrl(s, to); if (s) ensureData(); }}
          placeholder="From…"
          label="Start station"
        />
        <StationPicker
          stations={stations.filter((s) => s.id !== from?.id)}
          lines={lines}
          value={to}
          onSelect={(s) => { setTo(s); syncUrl(from, s); if (s) ensureData(); }}
          placeholder="To…"
          label="Destination station"
        />
      </div>

      {from && to && loading && (
        <p className="mt-3 text-[0.8125rem]" style={{ color: 'var(--muted)' }}>
          Working it out…
        </p>
      )}

      {from && to && !loading && !journey && data && (
        <p className="mt-3 text-[0.8125rem]" style={{ color: 'var(--muted)' }}>
          No route listed between these stations.
        </p>
      )}

      {journey && (
        <div className="mt-4">
          <div className="flex flex-wrap items-baseline gap-x-5 gap-y-2">
            <Figure label="Fare from" value={fare ? formatRupees(fare[0]) : '—'} />
            <Figure label="Journey" value={String(journey[0])} unit="min" />
            <Figure label="Distance" value={String(journey[1])} unit="km" />
            {fare && (
              <Figure
                label={peak ? 'Smart card (peak)' : 'Smart card'}
                value={formatRupees(fareOptions(fare, peak)[2].amount)}
              />
            )}
          </div>

          <p
            className="mt-2.5 flex flex-wrap items-center gap-x-2 text-[0.75rem]"
            style={{ color: 'var(--muted)' }}
          >
            {journey[2] > 0 ? (
              <span className="flex items-center gap-1 font-medium" style={{ color: 'var(--warn)' }}>
                <InterchangeIcon size={13} /> {journey[2]} change{journey[2] > 1 ? 's' : ''}
              </span>
            ) : (
              <span>Direct — no change of line</span>
            )}
            <span>· {journey[3].length} stations</span>
          </p>

          {/*
            Buying a ticket has to be reachable wherever the fare is shown.
            This panel quoted a price and offered no way to act on it, so
            anyone planning from the home page had to find a station page
            first. Same link and same wording as the station panel.
          */}
          <a
            href={WHATSAPP_TICKET_URL}
            rel="noreferrer"
            className="tap mt-3 flex items-center gap-2.5 px-3"
            style={{
              borderRadius: 'var(--r-md)',
              border: '1px solid color-mix(in srgb, var(--good) 40%, transparent)',
              background: 'color-mix(in srgb, var(--good) 10%, transparent)',
            }}
          >
            <WhatsAppIcon />
            <span className="min-w-0 py-2">
              <span className="block text-[0.8125rem] font-semibold">
                Buy a QR ticket on WhatsApp
              </span>
              <span className="block text-[0.6875rem]" style={{ color: 'var(--muted)' }}>
                Skip the queue · no app to install
              </span>
            </span>
          </a>

          <div className="mt-4">
            <JourneyPath path={journey[3]} stations={stations} />
          </div>
        </div>
      )}
    </section>
  );
}

function Figure({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="min-w-0">
      <div className="eyebrow">{label}</div>
      <div
        className="num mt-1 flex items-baseline gap-1 whitespace-nowrap text-[1.375rem] font-semibold leading-none"
        style={{ fontFamily: 'var(--font-mono), monospace' }}
      >
        {value}
        {unit && (
          <span className="text-[0.6875rem] font-medium" style={{ color: 'var(--muted)' }}>
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}
