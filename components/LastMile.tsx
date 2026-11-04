'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import {
  AUTO_TARIFF, WALKABLE_KM, WALK_TOO_FAR_KM, detectPlatform, rideApps, rideOptions,
  type Platform, type RideApp,
} from '@/lib/lastmile';
import { formatDistance, walkingMinutes } from '@/lib/geo';
import { directionsUrl } from '@/lib/maps';
import type { Station } from '@/types/transit';
import { lineVar } from './primitives';

/**
 * How to reach the nearest station.
 *
 * Two completely different answers, not one card with a toggle.
 *
 * Within 700m there is nothing to decide: walk, and here are the
 * directions. Offering a 100 rupee cab for a 52 metre stroll — which this
 * did — is not merely redundant, it makes every other figure on the page
 * look unconsidered. One bad number discredits the good ones.
 *
 * Beyond 700m the question is real, and then credibility is the design
 * problem. Every app price is an estimate against demand pricing nobody
 * can predict; exactly one figure, the auto meter, is a published legal
 * rate. Listing them as equals would launder guesswork into fact, so the
 * meter stands alone in the accent colour and every app price wears a
 * range.
 */
export function LastMile({
  station, distanceKm, minutesSinceMidnight, from, eyebrow = 'Your nearest metro', title,
  collapsible = false,
}: {
  station: Station;
  /**
   * Station page: within walking range the card folds to one line, because
   * most people there came for the trains, not a ride.
   */
  collapsible?: boolean;
  /** Replaces the station name as the heading, where the page already shows it. */
  title?: string;
  /** Label above the station name; the station page says "Getting here". */
  eyebrow?: string;
  distanceKm: number;
  /** The rider's fix, passed into the ride links so the app can prefill pickup. */
  from?: { lat: number; lon: number };
  /** From nowInBengaluru(), so the night tariff follows Bengaluru's clock. */
  minutesSinceMidnight: number;
}) {
  const hour = Math.floor(minutesSinceMidnight / 60);
  const walkable = distanceKm <= WALKABLE_KM;
  const walkHref = directionsUrl(station.lat, station.lon, `${station.name} Metro Station`);
  const destination = `${station.name} Metro Station`;
  const lineColour = lineVar(station.lines[0]);

  // The server cannot see the user agent the links are built for, so it
  // renders plain https links and the client swaps in the platform's own.
  const platform = useSyncExternalStore<Platform>(
    noSubscribe, () => detectPlatform(navigator.userAgent), () => 'other',
  );

  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  /*
    Apps that cannot take a destination get the station name on the
    clipboard, so the rider pastes it instead of typing it.

    The write starts inside the tap and the navigation is NOT delayed for
    it: app hand-off needs the user gesture, and a setTimeout before
    navigating loses it. The toast stays up so it is still there when the
    rider comes back from the app.
  */
  const onAppTap = (app: RideApp) => {
    if (app.prefill === 'trip') return;
    navigator.clipboard?.writeText(destination).catch(() => {});
    setToast(`Copied “${destination}” — paste it as the drop in ${app.name}`);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 6000);
  };

  const header = (
    <div className="flex items-start gap-3 px-4 pt-4 md:px-5">
      <span
        className="chip-grad mt-0.5 h-11 w-11 shrink-0"
        style={{ ['--chip-a' as string]: lineColour, ['--chip-b' as string]: `color-mix(in srgb, ${lineColour} 65%, #01292a)` }}
        aria-hidden
      >
        {walkable ? <WalkIcon /> : <RouteIcon />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="eyebrow">{eyebrow}</p>
        <h2 className="mt-0.5 text-balance text-[1.375rem] font-semibold leading-tight tracking-[-0.03em]">
          {title ?? station.name}
        </h2>
        {!title && station.nameKn && (
          <p className="truncate text-[0.8125rem]" style={{ color: 'var(--muted)' }} lang="kn">
            {station.nameKn}
          </p>
        )}
      </div>
      <div className="shrink-0 text-right">
        <p className="num text-[1.125rem] font-bold leading-tight"
          >
          {formatDistance(distanceKm)}
        </p>
        <p className="text-[0.6875rem]" style={{ color: 'var(--muted)' }}>
          {/* Past a short stroll, walking minutes are noise: nobody walks 3 hours. */}
          {distanceKm > WALK_TOO_FAR_KM ? 'straight line' : `${walkingMinutes(distanceKm)} min walk`}
        </p>
      </div>
    </div>
  );

  if (collapsible && distanceKm <= WALK_TOO_FAR_KM && !open) {
    const summary = walkable
      ? `${formatDistance(distanceKm)} · ${walkingMinutes(distanceKm)} min walk`
      : `${formatDistance(distanceKm)} · auto ₹${rideOptions(distanceKm, hour).find((o) => o.exact)!.low} by meter`;
    const row = (
      <>
        <span
          className="chip-grad h-10 w-10 shrink-0"
          style={{ ['--chip-a' as string]: lineColour, ['--chip-b' as string]: `color-mix(in srgb, ${lineColour} 65%, #01292a)` }}
          aria-hidden
        >
          {walkable ? <WalkIcon size={20} /> : <RouteIcon />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="eyebrow block">{eyebrow}</span>
          <span className="num block truncate text-[0.9375rem] font-semibold">{summary}</span>
        </span>
        <span className="flex shrink-0 items-center gap-0.5 text-[0.8125rem] font-semibold" style={{ color: 'var(--accent)' }}>
          {walkable ? 'Directions' : 'Rides'} <Chevron />
        </span>
      </>
    );
    return (
      <section className="card min-w-0 overflow-hidden">
        {walkable ? (
          <a href={walkHref} rel="noreferrer" className="press tap flex w-full items-center gap-3 px-4 py-3">{row}</a>
        ) : (
          <button type="button" onClick={() => setOpen(true)} aria-expanded={false}
            className="press tap flex w-full items-center gap-3 px-4 py-3 text-left">{row}</button>
        )}
      </section>
    );
  }

  if (walkable) {
    return (
      <section className="card ring-accent stop-in min-w-0 overflow-hidden">
        {header}
        <div className="px-4 pb-4 pt-3 md:px-5">
          <p className="text-[0.875rem]" style={{ color: 'var(--muted)' }}>
            Close enough to walk — no ride needed.
          </p>
          <a href={walkHref} rel="noreferrer" className="btn-primary press mt-3 w-full">
            <WalkIcon size={18} /> Walking directions
          </a>
        </div>
      </section>
    );
  }

  const meter = rideOptions(distanceKm, hour).find((o) => o.exact)!;
  const apps = rideApps(distanceKm, hour, station.lat, station.lon, station.name, from, platform);

  return (
    <section className="card ring-accent stop-in min-w-0 overflow-hidden">
      {header}

      {/* The trip as the apps will see it: where you are, where you are going. */}
      <div className="tile mx-4 mt-4 flex gap-3 px-3.5 py-3 md:mx-5">
        <div className="flex flex-col items-center pt-1.5" aria-hidden>
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: 'var(--good)', boxShadow: '0 0 0 4px color-mix(in srgb, var(--good) 20%, transparent)' }} />
          <span className="route-track my-1 min-h-5" />
          <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: lineColour, boxShadow: `0 0 0 4px color-mix(in srgb, ${lineColour} 22%, transparent)` }} />
        </div>
        <div className="min-w-0 flex-1 text-[0.875rem]">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Pickup</p>
          <p className="truncate font-semibold">{from ? 'Your current location' : 'Your phone’s location'}</p>
          <p className="mt-2 text-[0.6875rem] font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Drop</p>
          <p className="truncate font-semibold">{destination}</p>
        </div>
      </div>

      {/*
        The anchor, alone above the apps.

        Every app price below is an estimate against demand pricing; this is
        the one figure anyone can hold a driver to, so it is stated once,
        prominently, rather than buried as the second of four similar-looking
        rows where it reads as just another guess.
      */}
      <div className="mx-4 mt-3 flex items-center gap-3 px-3.5 py-3.5 md:mx-5"
        style={{
          borderRadius: 'var(--r-md)',
          background: 'var(--brand-gradient)',
          color: '#ffffff',
          boxShadow: 'var(--glow)',
          ['--muted' as string]: 'rgba(255,255,255,.8)',
          ['--accent' as string]: '#a6d8d4',
        }}
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
          style={{ background: 'rgba(255,255,255,.2)', color: '#ffffff' }} aria-hidden>
          <MeterIcon />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[0.875rem] font-semibold">{meter.label}</p>
          <p className="text-[0.75rem] leading-snug" style={{ color: 'var(--muted)' }}>{meter.note}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="num text-[1.5rem] font-bold leading-none" style={{ color: 'var(--accent)' }}>
            ₹{meter.low}
          </p>
          <p className="mt-1 text-[0.625rem] font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>fixed by law</p>
        </div>
      </div>

      <div className="px-4 pb-2 pt-5 md:px-5">
        <div className="flex items-baseline justify-between pb-2.5">
          <h3 className="text-[0.9375rem] font-semibold tracking-[-0.01em]">Book a ride</h3>
          <span className="text-[0.6875rem]" style={{ color: 'var(--muted)' }}>Estimates · tap to open</span>
        </div>
        {/* One list with hairlines, not four look-alike cards. */}
        <ul className="tile overflow-hidden p-0 [&>li+li]:border-t [&>li+li]:border-[var(--rule)]">
          {apps.map((app) => {
            const auto = app.modes.find((m) => m.kind === 'auto');
            const others = app.modes.filter((m) => m.kind !== 'auto');
            const filled = app.prefill === 'trip';
            return (
              <li key={app.name} className="min-w-0">
                <a
                  href={app.href}
                  /*
                    Deliberately NOT target="_blank".

                    These are Universal Links (iOS), App Links and intents
                    (Android): the OS hands off to the installed app, and that
                    handoff is only dependable on a plain top-level navigation
                    from a tap. A new tab makes the browser render the website
                    instead often enough to matter.
                  */
                  rel="noreferrer"
                  onClick={() => onAppTap(app)}
                  className="press tap flex min-w-0 items-center gap-3 px-3.5 py-3"
                  style={{ color: 'var(--ink)' }}
                  aria-label={
                    `${app.name}${app.note ? `, ${app.note}` : ''}: `
                    + `${app.modes.map((m) => `${m.label} ₹${m.low} to ₹${m.high}`).join(', ')}. `
                    + (filled
                      ? `Opens with your location and ${destination} filled in.`
                      : `Opens the app and copies ${destination} for you to paste.`)
                  }
                >
                  <AppMark name={app.name} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[0.9375rem] font-bold leading-tight">{app.name}</span>
                    {others.length > 0 && (
                      <span className="num mt-0.5 block text-[0.75rem] leading-snug" style={{ color: 'var(--muted)' }}>
                        {others.map((m) => `${m.label} ₹${m.low}–${m.high}`).join(' · ')}
                      </span>
                    )}
                    <span className="mt-1 flex items-center gap-1 whitespace-nowrap text-[0.6875rem] font-semibold"
                      style={{ color: filled ? 'var(--good)' : 'var(--muted)' }}>
                      {filled ? <CheckIcon size={12} /> : <CopyIcon />}
                      {filled ? 'Fills pickup & drop' : 'Copies station name'}
                    </span>
                  </span>
                  {auto && (
                    <span className="shrink-0 text-right">
                      <span className="num block text-[1.0625rem] font-bold leading-tight">
                        ₹{auto.low}&ndash;{auto.high}
                      </span>
                      <span className="block text-[0.6875rem]" style={{ color: 'var(--muted)' }}>Auto</span>
                    </span>
                  )}
                  <Chevron />
                </a>
              </li>
            );
          })}
        </ul>

        {/* No target="_blank", same reasoning as the app links above. */}
        {distanceKm <= WALK_TOO_FAR_KM && (
          <a href={walkHref} rel="noreferrer" className="btn-ghost press mt-3 w-full text-[0.875rem]">
            <WalkIcon size={16} /> Walk instead · {walkingMinutes(distanceKm)} min
          </a>
        )}
      </div>

      <details className="group px-4 pb-4 pt-1 md:px-5">
        <summary
          className="flex cursor-pointer list-none items-center gap-1.5 py-2 text-[0.75rem] font-semibold"
          style={{ color: 'var(--muted)' }}
        >
          <span className="transition-transform duration-200 group-open:rotate-90" aria-hidden>›</span>
          How these fares are worked out
        </summary>
        <p className="text-[0.6875rem] leading-relaxed" style={{ color: 'var(--muted)' }}>
          Metered auto fare is the {AUTO_TARIFF.source} rate card
          (₹{AUTO_TARIFF.baseRupees} for {AUTO_TARIFF.baseKm} km, then ₹{AUTO_TARIFF.perKmRupees}/km;
          1.5&times; from 10pm to 5am), checked {AUTO_TARIFF.lastVerified}. App fares are estimates
          only — they move with demand and weather, and the app will quote the real price.
          Distances are straight-line with a road allowance, so treat them as approximate.
          Bike taxis are operating under appeal in Karnataka, so they may not be bookable on the day.
          Rapido and Namma Yatri publish no way to pre-fill a trip, so for those the station name
          is copied for you to paste.
        </p>
      </details>

      {/* Portalled: .stop-in leaves an identity transform on the card, which
          makes position: fixed resolve against the card instead of the screen. */}
      {toast && createPortal(
        <div role="status" className="toast w-[min(92vw,26rem)] px-4 py-3 text-[0.8125rem] font-medium"
          style={{
            borderRadius: 'var(--r-md)',
            background: 'var(--ink)',
            color: 'var(--ground)',
            boxShadow: 'var(--shadow-pop)',
          }}
        >
          <span className="flex items-start gap-2.5">
            <CheckIcon />
            <span>{toast}</span>
          </span>
        </div>,
        document.body,
      )}
    </section>
  );
}

// The user agent never changes during a visit, so there is nothing to subscribe to.
const noSubscribe = () => () => {};

/*
  Lettered marks, not the companies' logos: recognisable by colour and
  initial without reproducing anyone's trademark.
*/
const MARKS: Record<string, { text: string; bg: string; fg: string }> = {
  'Namma Yatri': { text: 'NY', bg: '#ffd23f', fg: '#1b1b1b' },
  Rapido: { text: 'R', bg: '#f9c933', fg: '#111111' },
  Uber: { text: 'U', bg: '#000000', fg: '#ffffff' },
  Ola: { text: 'O', bg: '#cddc39', fg: '#111111' },
};

function AppMark({ name }: { name: string }) {
  const m = MARKS[name] ?? { text: name[0], bg: 'var(--sunken)', fg: 'var(--ink)' };
  return (
    <span
      className="flex h-9 w-9 shrink-0 items-center justify-center text-[0.8125rem] font-extrabold"
      style={{
        borderRadius: 10,
        background: m.bg,
        color: m.fg,
        boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.06)',
      }}
      aria-hidden
    >
      {m.text}
    </span>
  );
}

function Svg({ size = 18, children }: { size?: number; children: React.ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {children}
    </svg>
  );
}

function WalkIcon({ size = 22 }: { size?: number }) {
  return (
    <Svg size={size}>
      <circle cx="13" cy="4.5" r="2" />
      <path d="M10 21l2-6 3 3v3M9 12l1.5-4.5L14 9l2 3M7 21l2.5-7" />
    </Svg>
  );
}

function RouteIcon() {
  return (
    <Svg size={22}>
      <circle cx="6" cy="19" r="2.5" /><circle cx="18" cy="5" r="2.5" />
      <path d="M8.5 19H16a3.5 3.5 0 0 0 0-7H8a3.5 3.5 0 0 1 0-7h7.5" />
    </Svg>
  );
}

function MeterIcon() {
  return (
    <Svg size={17}>
      <path d="M4 15a8 8 0 1 1 16 0" /><path d="M12 15l4-5" /><path d="M3 19h18" />
    </Svg>
  );
}

function CheckIcon({ size = 16 }: { size?: number }) {
  return <Svg size={size}><path d="M5 12.5l4.5 4.5L19 7.5" /></Svg>;
}

function CopyIcon() {
  return (
    <Svg size={12}>
      <rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a1 1 0 0 1 1-1h9" />
    </Svg>
  );
}

function Chevron() {
  return (
    <span style={{ color: 'var(--muted)' }}><Svg size={16}><path d="M9 6l6 6-6 6" /></Svg></span>
  );
}
