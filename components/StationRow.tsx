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
  station, lines, distanceKm, grouped = false,
}: { station: Station; lines: Line[]; distanceKm?: number; grouped?: boolean }) {
  // Inside a StationGroup the rail already carries the line colour, so a
  // single-line tag repeats it; only interchanges keep their tags.
  const showTags = !grouped || station.lines.length > 1;
  return (
    <Link
      href={`/station/${station.id}`}
      className={grouped
        ? 'press tap flex min-w-0 items-stretch gap-3 px-4 py-3'
        : 'card press lift tap flex min-w-0 items-stretch gap-3 px-3.5 py-3'}
      style={grouped ? undefined : { borderRadius: 'var(--r-md)' }}
    >
      <Rail line={station.lines[0]} />

      <span className="min-w-0 flex-1 py-0.5">
        <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="truncate text-[1rem] font-bold leading-tight tracking-tight">
            {station.name}
          </span>
          {/*
            BMRCL's signage is bilingual and every station in the feed has a
            Kannada name, so this is the string that matches what is written
            on the platform — and the one to show an auto driver. Previously
            it appeared only on the station page heading.
          */}
          {station.nameKn && (
            <span
              className="truncate text-[0.8125rem] leading-tight"
              style={{ color: 'var(--muted)' }}
              lang="kn"
            >
              {station.nameKn}
            </span>
          )}
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
              style={{ color: 'var(--ink)' }}
            >
              {formatDistance(distanceKm)}
              <span style={{ color: 'var(--muted)' }}> · {walkingMinutes(distanceKm)} min walk</span>
            </span>
          )}
          <ParkingChip station={station} />
        </span>
      </span>

      {showTags && (
        <span className="flex shrink-0 flex-col items-end justify-center gap-1">
          {station.lines.map((l) => <LineTag key={l} line={l} lines={lines} />)}
        </span>
      )}
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden
        className="shrink-0 self-center" style={{ color: 'var(--muted)', opacity: .6 }}>
        <path d="M9 6l6 6-6 6" />
      </svg>
    </Link>
  );
}

/** Rows in one card with hairlines between them, instead of a card per row. */
export function StationGroup({ children }: { children: React.ReactNode }) {
  return (
    <div className="card min-w-0 overflow-hidden [&>*+*]:border-t [&>*+*]:border-[var(--rule)]"
      style={{ borderRadius: 'var(--r-lg)' }}>
      {children}
    </div>
  );
}
