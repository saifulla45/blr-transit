'use client';

import { haversineKm } from '@/lib/geo';
import { isInIndia, nearestMetroCity } from '@/lib/cities';

/**
 * What someone outside Bengaluru sees.
 *
 * The site is on the open internet, so a share on WhatsApp reaches Chennai
 * and Dubai as easily as Jayanagar. The previous version told those visitors
 * the nearest station was 290 km away and stopped there, which is accurate
 * and insulting — they know where they are.
 *
 * Three cases, in descending order of how much we can help:
 *   1. Near another Indian metro — name it and hand over their operator.
 *   2. Elsewhere in India — say plainly that this is Bengaluru-only.
 *   3. Abroad — same, minus the pretence that we know the local network.
 *
 * Every case keeps the browse and search below usable, because planning a
 * Bengaluru trip from somewhere else is a real reason to be here.
 */
export function OutOfArea({
  lat, lon, nearestStationKm,
}: {
  lat: number;
  lon: number;
  nearestStationKm: number;
}) {
  const match = nearestMetroCity(lat, lon, haversineKm);
  const inIndia = isInIndia(lat, lon);

  const heading = match
    ? `You're in ${match.city.name}, not Bengaluru`
    : inIndia
      ? 'You’re outside Bengaluru'
      : 'You’re outside India';

  return (
    <section
      className="stop-in min-w-0 md:col-span-2"
      style={{
        borderRadius: 'calc(var(--r-md) * 2)',
        background: 'color-mix(in srgb, var(--warn) 12%, transparent)',
        border: '1px solid color-mix(in srgb, var(--warn) 40%, transparent)',
      }}
    >
      <div className="px-4 py-3.5">
        <p className="text-[0.9375rem] font-semibold" style={{ color: 'var(--warn)' }}>
          {heading}
        </p>

        <p className="mt-1 text-[0.8125rem] leading-relaxed" style={{ color: 'var(--ink)' }}>
          This covers Bengaluru&rsquo;s Namma Metro only — the nearest station is{' '}
          <span className="num">{Math.round(nearestStationKm).toLocaleString('en-IN')} km</span> away.
          {/* No call to action here when there is no city to hand over to —
              the line below already points at search, and saying "below"
              twice in consecutive sentences reads as a copy error. */}
          {match && ` ${match.city.name} has its own network:`}
        </p>

        {match && (
          <a
            href={match.city.url}
            target="_blank"
            rel="noopener noreferrer"
            className="tap mt-2.5 inline-flex items-center gap-1.5 px-3.5 text-[0.875rem] font-semibold"
            style={{
              borderRadius: 'var(--r-md)',
              background: 'var(--accent)',
              color: 'var(--on-accent)',
              lineHeight: '44px',
            }}
          >
            {match.city.system}
            <Arrow />
          </a>
        )}

        <p className="mt-2.5 text-[0.75rem]" style={{ color: 'var(--muted)' }}>
          {match
            ? 'Planning a Bengaluru trip? Search or browse all 83 stations below.'
            : 'Search or browse all 83 stations below.'}
        </p>
      </div>
    </section>
  );
}

function Arrow() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M6 3h7v7M13 3 3.5 12.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
