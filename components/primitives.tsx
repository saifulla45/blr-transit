import type { Line, LineId, Station } from '@/types/transit';

/** Maps a line to its CSS custom property, so themes swap both at once. */
export function lineVar(line: LineId): string {
  return line === 'PURPLE' ? 'var(--line-purple)'
    : line === 'GREEN' ? 'var(--line-green)'
    : 'var(--line-yellow)';
}

export function lineName(line: LineId, lines: Line[]): string {
  return lines.find((l) => l.id === line)?.name ?? line;
}

/**
 * A short segment of the line, with a node marking this station. Structural
 * rather than decorative: the colour tells you which line you are on and the
 * node tells you where you are standing.
 */
export function Rail({ line }: { line: LineId }) {
  return <span className="rail" style={{ ['--rail-color' as string]: lineVar(line) }} aria-hidden />;
}

/** Small line identifier. Text-on-colour, sized for a glance not a read. */
export function LineTag({ line, lines }: { line: LineId; lines: Line[] }) {
  return (
    <span
      className="inline-flex items-center px-1.5 py-px text-[0.6875rem] font-semibold uppercase tracking-wide"
      style={{
        borderRadius: 'var(--r-sm)',
        // Tinted ground rather than a solid fill: three saturated pills in a
        // row shout, and Yellow needs dark text anyway.
        background: `color-mix(in srgb, ${lineVar(line)} 16%, transparent)`,
        color: lineVar(line),
      }}
    >
      {lineName(line, lines)}
    </span>
  );
}

/**
 * Parking shown as state, not just a number — a station with no parking is a
 * different kind of answer from one with 700 spaces, and both matter when you
 * are deciding whether to drive.
 */
export function ParkingChip({ station }: { station: Station }) {
  const p = station.parking;
  if (!p) {
    return (
      <span className="text-[0.75rem]" style={{ color: 'var(--muted)' }}>
        No parking
      </span>
    );
  }
  return (
    <span
      className="num inline-flex items-center gap-2 text-[0.75rem]"
      style={{ color: 'var(--muted)', fontFamily: 'var(--font-mono), monospace' }}
    >
      <span title={`${p.twoWheeler} two-wheeler spaces`}>
        <TwoWheeler /> {p.twoWheeler.toLocaleString('en-IN')}
      </span>
      {p.fourWheeler > 0 && (
        <span title={`${p.fourWheeler} four-wheeler spaces`}>
          <Car /> {p.fourWheeler.toLocaleString('en-IN')}
        </span>
      )}
    </span>
  );
}

/* Inline glyphs rather than emoji: emoji render inconsistently across
   platforms and read as decoration where these carry meaning. */

export function TwoWheeler() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className="inline-block align-[-2px]" aria-hidden>
      <circle cx="5" cy="17" r="3.5" /><circle cx="19" cy="17" r="3.5" />
      <path d="M5 17l4-8h5" /><path d="M14 9l3 8" /><path d="M12 6h4" />
    </svg>
  );
}

export function Car() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className="inline-block align-[-2px]" aria-hidden>
      <path d="M3 13l1.8-4.6A2 2 0 0 1 6.7 7h10.6a2 2 0 0 1 1.9 1.4L21 13" />
      <path d="M3 13h18v4H3z" /><circle cx="7" cy="17.5" r="1.5" /><circle cx="17" cy="17.5" r="1.5" />
    </svg>
  );
}

export function Accessible() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className="inline-block align-[-2px]" aria-hidden>
      <circle cx="12" cy="4.5" r="2" />
      <path d="M12 8v5h4l3 6" /><path d="M12 13H9l-2 6" />
    </svg>
  );
}
