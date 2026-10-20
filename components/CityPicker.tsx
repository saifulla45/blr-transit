'use client';

import { METRO_CITIES } from '@/lib/cities';

/**
 * Pick a different city.
 *
 * Being outside Bengaluru is not the same as being done. Someone in Kochi
 * might be planning next week's Bengaluru trip, or might simply want their
 * own network — and guessing which is rude. So both stay one tap away
 * instead of the page deciding for them.
 *
 * The honest limit, stated in the UI rather than discovered by clicking:
 * this site holds Bengaluru timetables only. Other cities are a handoff to
 * their operator, not a promise of departures we do not have. Pretending
 * otherwise would be the worst outcome — a city list that looks like
 * coverage and turns out to be bookmarks.
 */
export function CityPicker({ highlight }: { highlight?: string }) {
  return (
    <details className="group mt-3">
      <summary
        className="tap flex cursor-pointer list-none items-center gap-1.5 text-[0.8125rem] font-semibold"
        style={{ color: 'var(--accent)' }}
      >
        <Chevron />
        Choose a different city
      </summary>

      <div className="pt-2.5">
        <p className="pb-2 text-[0.75rem] leading-relaxed" style={{ color: 'var(--muted)' }}>
          Timetables here are Bengaluru only. These open each city&rsquo;s own operator.
        </p>

        <ul className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          {METRO_CITIES.map((city) => (
            <li key={city.name} className="min-w-0">
              <a
                href={city.url}
                target="_blank"
                rel="noopener noreferrer"
                className="tap flex min-w-0 flex-col justify-center px-2.5 py-1.5"
                style={{
                  borderRadius: 'var(--r-md)',
                  border: '1px solid var(--rule)',
                  background: city.name === highlight ? 'var(--raised)' : 'transparent',
                }}
                aria-label={`${city.name} — open ${city.system} in a new tab`}
              >
                <span className="truncate text-[0.8125rem] font-medium">{city.name}</span>
                <span className="truncate text-[0.6875rem]" style={{ color: 'var(--muted)' }}>
                  {city.system}
                </span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}

function Chevron() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
      className="shrink-0 transition-transform group-open:rotate-90"
    >
      <path d="m6 3 5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
