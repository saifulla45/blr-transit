import type { StationLite } from '@/types/transit';
import { lineVar } from './primitives';

/**
 * Every station between origin and destination, drawn as a line diagram whose
 * stops fade in along the route.
 *
 * The stagger is doing a job rather than decorating: it traces the journey in
 * travel order, so the direction you will ride is unambiguous. It is pure CSS
 * with an inline delay per stop — no state, and the reduced-motion rule in
 * globals.css neutralises it automatically.
 */
export function JourneyPath({ path, stations }: { path: string[]; stations: StationLite[] }) {
  const byId = new Map(stations.map((s) => [s.id, s]));
  if (path.length < 2) return null;

  // Colour each leg by the line the two stations share, so an interchange shows
  // up as the colour changing partway down the diagram.
  const legColour = (i: number): string => {
    const a = byId.get(path[i]);
    const b = byId.get(path[i + 1]);
    if (!a || !b) return 'var(--rule)';
    const shared = a.lines.find((l) => b.lines.includes(l));
    return shared ? lineVar(shared) : 'var(--rule)';
  };

  // Long journeys still finish in about a second.
  const step = Math.max(28, Math.min(90, 900 / path.length));

  return (
    <ol className="mt-3 flex flex-col" aria-label={`${path.length} stations from start to finish`}>
      {path.map((id, i) => {
        const station = byId.get(id);
        const first = i === 0;
        const last = i === path.length - 1;
        const colour = last ? legColour(i - 1) : legColour(i);
        const changesHere = !first && !last && legColour(i - 1) !== legColour(i);

        return (
          <li
            key={`${id}-${i}`}
            className="stop-in flex items-stretch gap-3"
            style={{ animationDelay: `${Math.round(i * step)}ms` }}
          >
            <span className="relative flex w-4 shrink-0 flex-col items-center">
              {!first && (
                <span className="w-[3px] flex-1" style={{ background: legColour(i - 1), opacity: 0.5 }} />
              )}
              <span
                className="shrink-0 rounded-full"
                style={{
                  width: first || last ? 13 : 9,
                  height: first || last ? 13 : 9,
                  background: first || last ? colour : 'var(--surface)',
                  border: `3px solid ${colour}`,
                }}
              />
              {!last && (
                <span className="w-[3px] flex-1" style={{ background: legColour(i), opacity: 0.5 }} />
              )}
            </span>

            <span className="min-w-0 py-1">
              <span
                className={`block truncate text-[0.875rem] ${first || last ? 'font-semibold' : ''}`}
                style={{ color: first || last ? 'var(--ink)' : 'var(--muted)' }}
              >
                {station?.name ?? id}
              </span>
              {changesHere && (
                <span className="text-[0.6875rem] font-semibold" style={{ color: 'var(--warn)' }}>
                  Change here
                </span>
              )}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
