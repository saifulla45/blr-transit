'use client';

import { AUTO_TARIFF, rideAppLinks, rideOptions, type RideOption } from '@/lib/lastmile';
import { formatDistance } from '@/lib/geo';
import { directionsUrl } from '@/lib/maps';
import type { Station } from '@/types/transit';

/**
 * How to cover the gap when the nearest station is past walking distance.
 *
 * The design problem here is credibility. Three of the four fares are
 * estimates against demand pricing nobody can predict, and one — the auto
 * meter — is a published legal rate. Flattening them into one list of
 * confident numbers would launder the guesswork into fact, so the exact fare
 * is typographically distinct and the estimates wear their ranges openly.
 */
export function LastMile({
  station, distanceKm, minutesSinceMidnight,
}: {
  station: Station;
  distanceKm: number;
  /** From nowInBengaluru(), so the night tariff follows Bengaluru's clock. */
  minutesSinceMidnight: number;
}) {
  const hour = Math.floor(minutesSinceMidnight / 60);
  const options = rideOptions(distanceKm, hour);
  const apps = rideAppLinks(station.lat, station.lon, station.name);

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
          {formatDistance(distanceKm)} away — further than most people want to walk.
        </p>
      </header>

      <ul className="flex flex-col" style={{ borderTop: '1px solid var(--rule)' }}>
        {options.map((option) => (
          <FareRow key={option.mode} option={option} />
        ))}
      </ul>

      <div className="px-4 py-3" style={{ borderTop: '1px solid var(--rule)' }}>
        <p className="eyebrow pb-2">Book a ride</p>
        <div className="flex flex-wrap gap-2">
          {apps.map((app) => (
            <a
              key={app.name}
              href={app.href}
              target="_blank"
              rel="noopener noreferrer"
              className="tap inline-flex items-center px-3.5 text-[0.8125rem] font-semibold"
              style={{
                borderRadius: 'var(--r-md)',
                border: '1px solid var(--rule)',
                background: 'var(--raised)',
                color: 'var(--ink)',
                lineHeight: '44px',
              }}
              aria-label={
                app.hasDestination
                  ? `Open ${app.name} with ${station.name} metro station set as the destination`
                  : `Open ${app.name}`
              }
            >
              {app.name}
              {!app.hasDestination && (
                <span className="pl-1.5 text-[0.6875rem] font-normal" style={{ color: 'var(--muted)' }}>
                  app
                </span>
              )}
            </a>
          ))}
        </div>

        <a
          href={directionsUrl(station.lat, station.lon, `${station.name} Metro Station`)}
          target="_blank"
          rel="noopener noreferrer"
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
      </p>
    </section>
  );
}

function FareRow({ option }: { option: RideOption }) {
  const range = option.exact
    ? `₹${option.low}`
    : `₹${option.low}–${option.high}`;

  return (
    <li
      className="flex min-w-0 items-baseline gap-3 px-4 py-2.5"
      style={{ borderBottom: '1px solid var(--rule)' }}
    >
      <div className="min-w-0 flex-1">
        <p className="text-[0.875rem] font-medium">{option.label}</p>
        {option.note && (
          <p className="text-[0.75rem] leading-snug" style={{ color: 'var(--muted)' }}>
            {option.note}
          </p>
        )}
      </div>

      <div className="shrink-0 text-right">
        <p
          className="num text-[0.9375rem] font-semibold"
          // The regulated fare is the only trustworthy number here, so it is
          // the only one given the accent.
          style={{ color: option.exact ? 'var(--accent)' : 'var(--ink)' }}
        >
          {range}
        </p>
        <p className="text-[0.6875rem]" style={{ color: 'var(--muted)' }}>
          {option.exact ? 'fixed by law' : 'estimate'}
        </p>
      </div>
    </li>
  );
}
