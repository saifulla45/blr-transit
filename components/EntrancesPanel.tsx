'use client';

import type { Station } from '@/types/transit';
import { formatDistance, haversineKm, walkingMinutes } from '@/lib/geo';
import { useLocation } from '@/lib/useLocation';
import { PinIcon } from './icons';
import { Panel } from './Panel';
import { directionsUrl } from '@/lib/maps';

/**
 * Which way into the station, and how long to allow.
 *
 * Every entrance in the feed carries coordinates, so with the rider's location
 * this becomes "use Entrance C, 2 min walk" instead of a list of letters.
 *
 * The gate-to-platform time comes from pathways.txt. Worth being precise about
 * what that is: the feed models fare gates only — it has no stairs, escalator
 * or lift data — so this is a duration, not a step-free route.
 */
export function EntrancesPanel({ station }: { station: Station }) {
  const { state } = useLocation();
  const entrances = station.entrances ?? [];
  if (entrances.length === 0) return null;

  const here = state.status === 'ready' ? state.coords : null;

  const ranked = entrances
    .map((e) => ({
      ...e,
      km: here ? haversineKm(here.lat, here.lon, e.lat, e.lon) : null,
    }))
    .sort((a, b) => (a.km ?? 0) - (b.km ?? 0));

  const nearest = here ? ranked[0] : null;
  const gateMin = Math.round((nearest?.toPlatformSec ?? 90) / 60);

  return (
    <Panel
      id="entrances"
      icon={<PinIcon size={16} />}
      title="Ways in"
      meta={`${entrances.length} entrance${entrances.length > 1 ? 's' : ''}`}
    >
      {nearest && nearest.km !== null ? (
        <div className="pb-3">
          <p className="text-[0.9375rem]">
            Closest to you:{' '}
            <strong>{nearest.name}</strong>{' '}
            <span style={{ color: 'var(--muted)' }}>
              · {formatDistance(nearest.km)}, about {walkingMinutes(nearest.km)} min walk
            </span>
          </p>
          <p className="mt-1 text-[0.8125rem]" style={{ color: 'var(--muted)' }}>
            Allow roughly {walkingMinutes(nearest.km) + Math.max(1, gateMin)} min from here to the
            platform — the walk plus about {Math.max(1, gateMin)} min through the gates.
          </p>
        </div>
      ) : (
        <p className="pb-3 text-[0.8125rem]" style={{ color: 'var(--muted)' }}>
          Share your location on the home page and this will tell you which entrance is closest.
        </p>
      )}

      <ul>
        {ranked.map((e) => (
          <li key={e.id} style={{ borderTop: '1px solid var(--rule)' }}>
            {/* Naming the right exit only helps if you can also walk to it. */}
            <a
              href={directionsUrl(e.lat, e.lon, `${station.name} ${e.name}`)}
              target="_blank"
              rel="noreferrer"
              className="tap flex items-center justify-between gap-3"
              aria-label={`Walking directions to ${station.name} ${e.name}`}
            >
              <span className="min-w-0 truncate text-[0.875rem]">{e.name}</span>
              <span className="flex shrink-0 items-center gap-2">
                {e.km !== null && (
                  <span
                    className="num text-[0.8125rem]"
                    style={{ color: 'var(--muted)', fontFamily: 'var(--font-mono), monospace' }}
                  >
                    {formatDistance(e.km)}
                  </span>
                )}
                <span className="text-[0.75rem] font-semibold" style={{ color: 'var(--accent)' }}>
                  Directions
                </span>
              </span>
            </a>
          </li>
        ))}
      </ul>

      <p className="pt-3 text-[0.75rem] leading-relaxed" style={{ color: 'var(--muted)' }}>
        Gate-to-platform time is from BMRCL&rsquo;s pathway data, which models fare gates only —
        it carries no lift or escalator information, so this is not a step-free route.
      </p>
    </Panel>
  );
}
