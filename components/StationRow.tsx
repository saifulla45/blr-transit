import Link from 'next/link';
import type { Line, Station } from '@/types/transit';
import { formatDistance, walkingMinutes } from '@/lib/geo';
import { LineTag, ParkingChip, Rail } from './primitives';
import { InterchangeIcon } from './icons';

/**
 * One station in a list. Carries the detail people actually decide on —
 * distance, lines, and whether they can park — so the list answers the
 * question without a tap.
 */
export function StationRow({
  station, lines, distanceKm,
}: { station: Station; lines: Line[]; distanceKm?: number }) {
  return (
    <Link
      href={`/station/${station.id}`}
      className="tap flex min-w-0 items-stretch gap-3 py-3 transition-colors"
      style={{ borderBottom: '1px solid var(--rule)' }}
    >
      <Rail line={station.lines[0]} />

      <span className="min-w-0 flex-1 py-0.5">
        <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="truncate text-[1.0625rem] font-semibold leading-tight">
            {station.name}
          </span>
          {station.isInterchange && (
            <span className="eyebrow flex items-center gap-1" style={{ color: 'var(--accent)' }}>
              <InterchangeIcon size={13} /> Interchange
            </span>
          )}
        </span>

        <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
          {distanceKm !== undefined && (
            <span
              className="num text-[0.75rem]"
              style={{ color: 'var(--ink)', fontFamily: 'var(--font-mono), monospace' }}
            >
              {formatDistance(distanceKm)}
              <span style={{ color: 'var(--muted)' }}> · {walkingMinutes(distanceKm)} min walk</span>
            </span>
          )}
          <ParkingChip station={station} />
        </span>
      </span>

      <span className="flex shrink-0 flex-col items-end justify-center gap-1">
        {station.lines.map((l) => <LineTag key={l} line={l} lines={lines} />)}
      </span>
    </Link>
  );
}
