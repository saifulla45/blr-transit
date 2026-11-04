import Link from 'next/link';
import type { Line, Station, StationLite } from '@/types/transit';
import { lineVar } from './primitives';

/**
 * Where this station sits on its line, with its neighbours as links.
 *
 * This is the piece of context a station page is otherwise missing: a rider
 * knows the station name but not which way is which, and "one stop before
 * Majestic" is often the thing they actually need.
 */
export function LineStrip({
  station, lines, stations,
}: { station: Station; lines: Line[]; stations: StationLite[] }) {
  const byId = new Map(stations.map((s) => [s.id, s]));

  return (
    <div className="flex flex-col gap-3">
      {station.lines.map((lineId) => {
        const line = lines.find((l) => l.id === lineId);
        if (!line?.order?.length) return null;
        const i = line.order.indexOf(station.id);
        if (i < 0) return null;

        const prev = i > 0 ? byId.get(line.order[i - 1]) : undefined;
        const next = i < line.order.length - 1 ? byId.get(line.order[i + 1]) : undefined;
        const colour = lineVar(lineId);

        return (
          <div key={lineId} className="min-w-0">
            <div className="flex items-baseline justify-between gap-2 pb-1.5">
              <span
                className="text-[0.6875rem] font-semibold uppercase tracking-wide"
                style={{ color: colour }}
              >
                {line.name} line
              </span>
              <span
                className="num text-[0.6875rem]"
                style={{ color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}
              >
                stop {i + 1} of {line.order.length}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Neighbour station={prev} colour={colour} side="prev" />

              {/* The current station: a filled node on the line. */}
              <span className="flex shrink-0 flex-col items-center px-0.5">
                <span
                  className="h-3.5 w-3.5 rounded-full"
                  style={{ background: colour, boxShadow: '0 0 0 3px var(--ground)' }}
                  aria-hidden
                />
              </span>

              <Neighbour station={next} colour={colour} side="next" />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Neighbour({
  station, colour, side,
}: { station?: StationLite; colour: string; side: 'prev' | 'next' }) {
  const align = side === 'prev' ? 'text-right' : 'text-left';

  // A terminus has nothing beyond it; say so rather than leaving a gap.
  if (!station) {
    return (
      <span
        className={`min-w-0 flex-1 ${align} text-[0.75rem]`}
        style={{ color: 'var(--muted)' }}
      >
        <span className="block h-[3px] w-full rounded" style={{ background: 'var(--rule)' }} aria-hidden />
        <span className="mt-1.5 block">Terminus</span>
      </span>
    );
  }

  return (
    <Link href={`/station/${station.id}`} className={`min-w-0 flex-1 ${align} group`}>
      <span
        className="block h-[3px] w-full rounded"
        style={{ background: colour, opacity: 0.4 }}
        aria-hidden
      />
      <span className="mt-1.5 flex items-baseline gap-1 text-[0.8125rem] group-hover:underline"
        style={{ justifyContent: side === 'prev' ? 'flex-end' : 'flex-start' }}>
        {side === 'prev' && <span aria-hidden style={{ color: 'var(--muted)' }}>←</span>}
        <span className="truncate">{station.name}</span>
        {side === 'next' && <span aria-hidden style={{ color: 'var(--muted)' }}>→</span>}
      </span>
    </Link>
  );
}
