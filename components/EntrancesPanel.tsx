'use client';

import type { Poi, Station } from '@/types/transit';
import { describeExits, nearestExit, type ExitInfo } from '@/lib/entrances';
import { formatDistance, walkingMinutes } from '@/lib/geo';
import { WALK_TOO_FAR_KM } from '@/lib/lastmile';
import { directionsUrl } from '@/lib/maps';
import { useLocation } from '@/lib/useLocation';
import { PinIcon } from './icons';
import { Panel } from './Panel';
import { lineVar } from './primitives';

/**
 * Which exit to use.
 *
 * The feed gives each entrance a letter and a coordinate, and a list of
 * bare letters ("Entrance A, Entrance B…") answered nothing. Each exit is
 * now described by the side of the station it opens onto and a landmark
 * beside it, drawn on a small plan, and the panel leads with one
 * recommendation: the exit to walk to when you are close, or the one to be
 * dropped at when you are coming by auto.
 *
 * The gate-to-platform time comes from pathways.txt, which models fare
 * gates only — no stairs, escalators or lifts — so it is a duration, not a
 * step-free route.
 */
export function EntrancesPanel({ station, pois }: { station: Station; pois: Poi[] }) {
  const { state } = useLocation();
  const exits = describeExits(station, pois);
  if (exits.length === 0) return null;

  const here = state.status === 'ready' ? state.coords : null;
  const best = here ? nearestExit(exits, here.lat, here.lon) : null;
  const walking = best !== null && best.km <= WALK_TOO_FAR_KM;
  const gateMin = Math.max(1, Math.round((best?.exit.toPlatformSec ?? 90) / 60));
  const lineColour = lineVar(station.lines[0]);

  return (
    <Panel
      id="entrances"
      icon={<PinIcon size={16} />}
      title="Which exit to use"
      meta={`${exits.length} exit${exits.length > 1 ? 's' : ''}`}
    >
      {best ? (
        <div
          className="flex items-center gap-3 p-3.5"
          style={{ borderRadius: 'var(--r-md)', background: 'var(--brand-gradient)', color: '#ffffff', boxShadow: 'var(--glow)' }}
        >
          <ExitBadge exit={best.exit} size={44} onColour />
          <div className="min-w-0 flex-1">
            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] opacity-80">
              {walking ? 'Closest to you' : 'Ask to be dropped at'}
            </p>
            <p className="text-[1.125rem] font-bold leading-tight">{best.exit.label}</p>
            <p className="mt-0.5 text-[0.8125rem] opacity-90">
              {walking
                ? `${formatDistance(best.km)} · ${walkingMinutes(best.km)} min walk, then about ${gateMin} min to the platform`
                : `The ${best.exit.side.toLowerCase()} side, facing your way in${best.exit.landmark ? ` — near ${best.exit.landmark.name}` : ''}`}
            </p>
          </div>
          {walking && (
            <a
              href={directionsUrl(best.exit.lat, best.exit.lon, `${station.name} ${best.exit.label}`)}
              rel="noreferrer"
              className="press shrink-0 rounded-full px-3.5 py-2 text-[0.8125rem] font-bold"
              style={{ background: 'var(--gold-gradient)', color: '#ffffff' }}
            >
              Go
            </a>
          )}
        </div>
      ) : (
        <p className="text-[0.875rem]" style={{ color: 'var(--muted)' }}>
          Each exit opens onto a different side of the station. Pick the one nearest where
          you are going — or share your location on the home page and this will pick for you.
        </p>
      )}

      <ExitPlan exits={exits} highlight={best?.exit.id} lineColour={lineColour} />

      <ul className="mt-1 flex flex-col">
        {exits.map((exit) => {
          const isBest = best?.exit.id === exit.id;
          return (
            <li key={exit.id} style={{ borderTop: '1px solid var(--rule)' }}>
              <a
                href={directionsUrl(exit.lat, exit.lon, `${station.name} ${exit.label}`)}
                rel="noreferrer"
                className="tap flex items-center gap-3 py-2.5"
                aria-label={`Walking directions to ${station.name} ${exit.label}, ${exit.side} side`}
              >
                <ExitBadge exit={exit} size={34} active={isBest} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[0.9375rem] font-semibold leading-tight">
                    {exit.label}
                    <span className="font-normal" style={{ color: 'var(--muted)' }}> · {exit.side} side</span>
                  </span>
                  <span className="block truncate text-[0.75rem]" style={{ color: 'var(--muted)' }}>
                    {exit.landmark ? `Near ${exit.landmark.name}` : 'No mapped landmark beside it'}
                  </span>
                </span>
                <span className="shrink-0 text-[0.75rem] font-semibold" style={{ color: 'var(--accent)' }}>
                  Directions
                </span>
              </a>
            </li>
          );
        })}
      </ul>

      <p className="pt-3 text-[0.75rem] leading-relaxed" style={{ color: 'var(--muted)' }}>
        Sides and landmarks are worked out from the exit&rsquo;s position on the map. BMRCL&rsquo;s
        data carries no lift or escalator information, so this is not a step-free route.
      </p>
    </Panel>
  );
}

function ExitBadge({
  exit, size, active = false, onColour = false,
}: { exit: ExitInfo; size: number; active?: boolean; onColour?: boolean }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center font-bold"
      style={{
        width: size,
        height: size,
        borderRadius: size / 3.2,
        fontSize: size * 0.42,
        ...(onColour
          ? { background: '#ffffff', color: '#013536' }
          : active
            ? { background: 'var(--brand-gradient)', color: '#ffffff', boxShadow: 'var(--glow)' }
            : { background: 'var(--sunken)', color: 'var(--ink)', border: '1px solid var(--rule)' }),
      }}
      aria-hidden
    >
      {exit.letter ?? <PinIcon size={Math.round(size * 0.45)} />}
    </span>
  );
}

/*
  A plan of the station: the station at the centre, each exit placed on the
  side it really is, north up. Distances are scaled so the furthest exit
  sits near the edge, with a minimum ring so no exit hides under the station.
*/
function ExitPlan({
  exits, highlight, lineColour,
}: { exits: ExitInfo[]; highlight?: string; lineColour: string }) {
  const W = 320;
  const H = 180;
  const cx = W / 2;
  const cy = H / 2;
  const maxR = Math.max(1, ...exits.map((e) => Math.hypot(e.east, e.north)));
  const place = (e: ExitInfo) => {
    const r = Math.hypot(e.east, e.north);
    const scale = (0.45 + 0.55 * (r / maxR)) / (r || 1);
    return { x: cx + e.east * scale * (W / 2 - 22), y: cy - e.north * scale * (H / 2 - 22) };
  };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="my-3 w-full" role="img"
      aria-label="Plan of the station with each exit on its side, north up">
      <rect x="1" y="1" width={W - 2} height={H - 2} rx="14" fill="var(--sunken)" stroke="var(--rule)" />
      <text x={W - 16} y="22" textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--muted)">N</text>
      <path d={`M${W - 16} 28 l-4 8 h8 z`} fill="var(--muted)" />

      {exits.map((e) => {
        const p = place(e);
        return <line key={`l-${e.id}`} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="var(--rule)" strokeWidth="2" strokeDasharray="3 4" />;
      })}

      <rect x={cx - 34} y={cy - 13} width="68" height="26" rx="8" fill={lineColour} />
      <text x={cx} y={cy + 4.5} textAnchor="middle" fontSize="11" fontWeight="700" fill="#ffffff">Station</text>

      {exits.map((e) => {
        const p = place(e);
        const on = e.id === highlight;
        return (
          <g key={e.id}>
            <circle cx={p.x} cy={p.y} r={on ? 14 : 12} fill={on ? 'var(--accent)' : 'var(--surface)'}
              stroke={on ? 'var(--accent)' : 'var(--ink)'} strokeWidth={on ? 0 : 1.5} />
            <text x={p.x} y={p.y + 4} textAnchor="middle" fontSize="11" fontWeight="700"
              fill={on ? '#ffffff' : 'var(--ink)'}>
              {e.letter ?? '•'}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
