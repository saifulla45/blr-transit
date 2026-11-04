import type { Station } from '@/types/transit';
import { directionsUrl } from '@/lib/maps';

/**
 * Street-level entrances and the Kannada name.
 *
 * "Which exit?" is a question every rider has and almost nothing answers. The
 * feed names all 235 entrances; they were simply never surfaced.
 */
/**
 * Exits as a one-line summary under the title. The full list, with distances,
 * lives in its own panel — this is just the glance.
 */
export function StationFacts({ station }: { station: Station }) {
  const entrances = station.entrances ?? [];

  return (
    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2 pt-1">
      <a
        href={directionsUrl(station.lat, station.lon, `${station.name} Metro Station`)}
        target="_blank"
        rel="noreferrer"
        className="frost press inline-flex items-center rounded-full px-3.5 py-1.5 text-[0.8125rem] font-semibold"
      >
        Directions to the station
      </a>

      {entrances.length > 0 && (
        <p className="text-[0.8125rem]" style={{ color: 'var(--muted)' }}>
          <a href="#entrances" className="eyebrow mr-1.5 underline decoration-dotted underline-offset-2">
            Exits
          </a>
          {/* Step-free is already a badge above; repeating it here was noise. */}
          {entrances.map((e) => e.name.replace(/^Entrance\s*/i, '')).join(' · ')}
        </p>
      )}
    </div>
  );
}
