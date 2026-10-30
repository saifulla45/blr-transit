'use client';

import { AUTO_TARIFF, WALKABLE_KM, rideApps, rideOptions } from '@/lib/lastmile';
import { formatDistance, walkingMinutes } from '@/lib/geo';
import { directionsUrl } from '@/lib/maps';
import type { Station } from '@/types/transit';

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
  station, distanceKm, minutesSinceMidnight, from,
}: {
  station: Station;
  distanceKm: number;
  /** The rider's fix, passed into the ride links so the app can prefill pickup. */
  from?: { lat: number; lon: number };
  /** From nowInBengaluru(), so the night tariff follows Bengaluru's clock. */
  minutesSinceMidnight: number;
}) {
  const hour = Math.floor(minutesSinceMidnight / 60);
  const walkable = distanceKm <= WALKABLE_KM;
  const walkHref = directionsUrl(station.lat, station.lon, `${station.name} Metro Station`);

  if (walkable) {
    return (
      <section
        className="stop-in min-w-0"
        style={{
          borderRadius: 'calc(var(--r-md) * 2)',
          background: 'var(--surface)',
          border: '1px solid var(--rule)',
        }}
      >
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5">
          <div className="min-w-0 flex-1">
            <h2 className="text-[0.9375rem] font-semibold">Walk to {station.name}</h2>
            <p className="mt-0.5 text-[0.8125rem]" style={{ color: 'var(--muted)' }}>
              {formatDistance(distanceKm)} · about {walkingMinutes(distanceKm)} min on foot.
            </p>
          </div>
          <a
            href={walkHref}
            rel="noreferrer"
            className="tap inline-flex shrink-0 items-center gap-1.5 px-3.5 text-[0.875rem] font-semibold"
            style={{
              borderRadius: 'var(--r-md)',
              background: 'var(--accent)',
              color: 'var(--on-accent)',
              lineHeight: '44px',
            }}
          >
            Walking directions
          </a>
        </div>
      </section>
    );
  }

  const meter = rideOptions(distanceKm, hour).find((o) => o.exact)!;
  const apps = rideApps(distanceKm, hour, station.lat, station.lon, station.name, from);

  return (
    <section
      className="stop-in min-w-0"
      style={{
        borderRadius: 'calc(var(--r-md) * 2)',
        background: 'var(--surface)',
        border: '1px solid var(--rule)',
      }}
    >
      <header className="px-4 pt-3.5 pb-2.5">
        <h2 className="text-[0.9375rem] font-semibold">
          Getting to {station.name}
        </h2>
        <p className="mt-0.5 text-[0.8125rem]" style={{ color: 'var(--muted)' }}>
          {formatDistance(distanceKm)} away, about {walkingMinutes(distanceKm)} min on foot —
          further than most people want to walk.
        </p>
      </header>

      {/*
        The anchor, alone above the apps.

        Every app price below is an estimate against demand pricing; this is
        the one figure anyone can hold a driver to, so it is stated once,
        prominently, rather than buried as the second of four similar-looking
        rows where it reads as just another guess.
      */}
      <div
        className="flex items-baseline gap-3 px-4 py-2.5"
        style={{ borderTop: '1px solid var(--rule)', borderBottom: '1px solid var(--rule)' }}
      >
        <div className="min-w-0 flex-1">
          <p className="text-[0.875rem] font-medium">{meter.label}</p>
          <p className="text-[0.75rem] leading-snug" style={{ color: 'var(--muted)' }}>
            {meter.note}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="num text-[1.0625rem] font-semibold" style={{ color: 'var(--accent)' }}>
            ₹{meter.low}
          </p>
          <p className="text-[0.6875rem]" style={{ color: 'var(--muted)' }}>fixed by law</p>
        </div>
      </div>

      <div className="px-4 py-3" style={{ borderTop: '1px solid var(--rule)' }}>
        <p className="eyebrow pb-2">Book a ride</p>
        <ul className="flex flex-col gap-1.5">
          {apps.map((app) => (
            <li key={app.name}>
              <a
                href={app.href}
                /*
                  Deliberately NOT target="_blank".

                  These are Universal Links (iOS) and App Links (Android):
                  the OS intercepts the https URL and hands off to the
                  installed app. That handoff is only dependable on a plain
                  top-level navigation from a tap — opening in a new tab makes
                  Safari render the website instead often enough to matter,
                  which is exactly the "it doesn't open the app" complaint.
                  Leaving the page is the right outcome here anyway; the user
                  is going to book a ride, and Back returns them.
                */
                rel="noreferrer"
                className="tap flex min-w-0 flex-col justify-center gap-1 px-3 py-2"
                style={{
                  borderRadius: 'var(--r-md)',
                  border: '1px solid var(--rule)',
                  background: 'var(--raised)',
                  color: 'var(--ink)',
                }}
                aria-label={
                  `${app.name}: ${app.modes.map((m) => `${m.label} ₹${m.low} to ₹${m.high}`).join(', ')}. `
                  + (app.hasDestination
                    ? `Opens with ${station.name} metro station set as the destination.`
                    : 'Opens the app.')
                }
              >
                <span className="flex min-w-0 items-center gap-2">
                  {/*
                    The name never shrinks and the note does. Reversed, a long
                    note squeezed "Namma Yatri" to zero width and the row
                    rendered as an anonymous price list.
                  */}
                  <span className="shrink-0 text-[0.875rem] font-semibold">{app.name}</span>
                  {app.note && (
                    <span
                      className="ml-auto min-w-0 truncate text-[0.6875rem]"
                      style={{ color: 'var(--muted)' }}
                    >
                      {app.note}
                    </span>
                  )}
                </span>

                <span className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                  {app.modes.map((m) => (
                    <span key={m.kind} className="flex items-baseline gap-1 text-[0.75rem]">
                      <span style={{ color: 'var(--muted)' }}>{m.label}</span>
                      <span className="num font-semibold">
                        ₹{m.low}&ndash;{m.high}
                      </span>
                    </span>
                  ))}
                </span>
              </a>
            </li>
          ))}
        </ul>

        {/* No target="_blank", same reasoning as the app links above: this is
            a Google Maps universal link, and the handoff to the Maps app is
            reliable on a top-level navigation. */}
        <a
          href={walkHref}
          rel="noreferrer"
          className="mt-2.5 inline-flex text-[0.8125rem] font-medium underline underline-offset-2"
          style={{ color: 'var(--accent)' }}
        >
          Walking directions instead
        </a>
      </div>

      <p
        className="px-4 pb-3.5 text-[0.6875rem] leading-relaxed"
        style={{ color: 'var(--muted)' }}
      >
        Metered auto fare is the {AUTO_TARIFF.source} rate card
        (₹{AUTO_TARIFF.baseRupees} for {AUTO_TARIFF.baseKm} km, then ₹{AUTO_TARIFF.perKmRupees}/km;
        1.5&times; from 10pm to 5am), checked {AUTO_TARIFF.lastVerified}. App fares are estimates
        only — they move with demand and weather, and the app will quote the real price.
        Distances are straight-line with a road allowance, so treat them as approximate.
        {' '}
        {/* Moved here when the generic bike row was removed; it is a caveat
            about availability rather than price, and it applies to whichever
            of the three apps you pick. */}
        Bike taxis are operating under appeal in Karnataka, so they may not be
        bookable on the day.
      </p>
    </section>
  );
}

