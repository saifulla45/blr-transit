'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  countRunning, project, trainsOnLine, type LiveNetwork as Net,
} from '@/lib/livePositions';
import { clockParts, nowInBengaluru, servicePatternFor } from '@/lib/time';
import type { CalendarOverrides } from '@/types/transit';
import { lineVar } from './primitives';

/**
 * The whole network, with every train where the timetable puts it.
 *
 * Two things make this honest as well as watchable.
 *
 * First, these are SCHEDULED positions. BMRCL runs no realtime feed, so no
 * app — including theirs — knows where a train physically is. The heading
 * says "scheduled", not "live".
 *
 * Second, the scrubber exists because of an awkward truth: at real speed a
 * train covers about a quarter of a pixel per second. A faithful live view
 * is indistinguishable from a still image. Rather than secretly speeding
 * the animation up — which would misrepresent the service — the default is
 * the real current time and moving through the day is something you
 * explicitly do, with the hour shown the whole while.
 *
 * Drawn as SVG rather than on the MapLibre map used elsewhere: no tiles, no
 * WebGL dependency, no 500KB of library, and a schematic reads better at
 * phone size than a geographic map covered in roads.
 */

/** Minutes of timetable advanced per real second while playing. */
const PLAY_RATE = 90;

export function LiveNetwork({
  net, overrides,
}: {
  net: Net;
  overrides: CalendarOverrides;
}) {
  const [now, setNow] = useState<ReturnType<typeof nowInBengaluru> | null>(null);
  /** null means "follow the clock"; a number means the scrubber is in charge. */
  const [scrubbed, setScrubbed] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    const tick = () => setNow(nowInBengaluru());
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  // Playback advances the scrubbed time; it never touches the real clock.
  useEffect(() => {
    if (!playing) return undefined;
    let previous = performance.now();
    const step = (t: number) => {
      const delta = (t - previous) / 1000;
      previous = t;
      setScrubbed((m) => {
        const next = (m ?? 0) + delta * PLAY_RATE;
        // Loop at the end of service rather than stopping dead.
        return next > 1500 ? 240 : next;
      });
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [playing]);

  const minutes = scrubbed ?? now?.minutes ?? 0;
  const pattern = now ? servicePatternFor(now.date, overrides, now.weekday) : 'weekday';

  // One projection across every station, so the three lines share a frame.
  const { toXY, aspect } = useMemo(
    () => project(net.lines.flatMap((l) => l.stations)),
    [net],
  );
  // The network is wider than it is tall; a square box would waste a third
  // of the panel. Clamped so an unusual future shape cannot make it absurd.
  const boxH = Math.round(1000 * Math.min(1.25, Math.max(0.55, aspect)));
  /** Tallest the map should ever be, and the width that implies. */
  const MAX_H = 460;
  const maxW = Math.round((MAX_H * 1000) / boxH);

  const running = now ? countRunning(net, pattern, minutes) : 0;
  const { time, meridiem } = clockParts(Math.round(minutes) % 1440);

  // Server render has no clock; wait for it rather than flashing a wrong time.
  if (!now) return null;

  const PAD = 0.06;
  const sx = (x: number) => PAD + x * (1 - PAD * 2);
  // y is normalised against the LONGER axis, so it scales by width too.
  const sy = (y: number) => PAD * (boxH / 1000) + y * (1 - PAD * 2);

  return (
    <section
      className="min-w-0"
      style={{
        borderRadius: 'calc(var(--r-md) * 2)',
        background: 'var(--surface)',
        border: '1px solid var(--rule)',
      }}
    >
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 pt-3.5 pb-2">
        <h2 className="text-[0.9375rem] font-semibold">
          {scrubbed === null ? 'Trains running now' : 'Trains at'}{' '}
          <span className="num" style={{ color: 'var(--accent)' }}>
            {time}<span className="text-[0.75em]">{meridiem}</span>
          </span>
        </h2>
        <span className="ml-auto flex items-center gap-1.5 text-[0.75rem]" style={{ color: 'var(--muted)' }}>
          <span
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{
              background: running > 0 ? 'var(--good)' : 'var(--muted)',
              animation: running > 0 ? 'pulse-dot 2s ease-in-out infinite' : undefined,
            }}
          />
          <span className="num font-semibold" style={{ color: 'var(--ink)' }}>{running}</span>
          {' '}on the network
        </span>
      </header>

      <div className="px-2 md:flex md:items-center md:gap-5 md:px-4">
        <svg
          viewBox={`0 0 1000 ${boxH}`}
          preserveAspectRatio="xMidYMid meet"
          className="mx-auto block w-full"
          /*
            Both dimensions are capped, and the WIDTH is the one doing the
            work. Unconstrained it grew to 840px tall on a desktop, where a
            three-line schematic became the whole screen. A max-height alone
            was not enough: width:100% wins over aspect-ratio, so the box
            stayed full width and the drawing just letterboxed inside it
            with empty margins. Capping max-width to the height limit times
            the aspect keeps the drawing flush to its frame at every size,
            while mobile still fills the column.
          */
          style={{ aspectRatio: `1000 / ${boxH}`, maxWidth: `${maxW}px` }}
          role="img"
          aria-label={`Schematic of the Namma Metro network with ${running} trains at their scheduled positions`}
        >
          <defs>
            <filter id="trainGlow" x="-120%" y="-120%" width="340%" height="340%">
              <feGaussianBlur stdDeviation="7" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          {net.lines.map((line) => {
            const pts = line.stations.map((s) => {
              const p = toXY(s.lat, s.lon);
              return { x: sx(p.x) * 1000, y: sy(p.y) * 1000 };
            });
            const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join('');
            const colour = lineVar(line.id as never);

            return (
              <g key={line.id}>
                {/* Soft underlay reads as a glow without a second filter pass. */}
                <path d={d} fill="none" stroke={colour} strokeWidth={11} opacity={0.18}
                  strokeLinecap="round" strokeLinejoin="round" />
                <path d={d} fill="none" stroke={colour} strokeWidth={3.5}
                  strokeLinecap="round" strokeLinejoin="round" />
                {pts.map((p, i) => (
                  <circle
                    key={line.stations[i].id}
                    cx={p.x}
                    cy={p.y}
                    r={3.2}
                    fill="var(--ground)"
                    stroke={colour}
                    strokeWidth={1.8}
                  />
                ))}
              </g>
            );
          })}

          {net.lines.flatMap((line) => {
            const colour = lineVar(line.id as never);
            return trainsOnLine(line, pattern, minutes).map((t, i) => {
              const a = toXY(line.stations[t.from].lat, line.stations[t.from].lon);
              const b = toXY(line.stations[t.to].lat, line.stations[t.to].lon);
              const x = (sx(a.x) + (sx(b.x) - sx(a.x)) * t.t) * 1000;
              const y = (sy(a.y) + (sy(b.y) - sy(a.y)) * t.t) * 1000;
              return (
                <circle
                  key={`${line.id}-${t.direction}-${i}`}
                  cx={x}
                  cy={y}
                  r={6}
                  fill={colour}
                  filter="url(#trainGlow)"
                />
              );
            });
          })}
        </svg>

        {/*
          The controls move alongside the map on wide screens. Centred under
          a 510px map in a 960px panel, the drawing looked marooned with a
          quarter of the panel empty on either side; putting the controls in
          that space makes the width deliberate instead of left over.
        */}
        <div className="px-2 pt-1 md:min-w-0 md:flex-1 md:px-0 md:pt-0">
          <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => { setPlaying((p) => !p); if (scrubbed === null) setScrubbed(minutes); }}
          className="tap flex shrink-0 items-center gap-1.5 px-3 text-[0.8125rem] font-semibold"
          style={{
            borderRadius: 'var(--r-md)',
            border: '1px solid var(--rule)',
            background: 'var(--raised)',
          }}
          aria-pressed={playing}
        >
          {playing ? 'Pause' : 'Play the day'}
        </button>

        <input
          type="range"
          min={240}
          max={1500}
          step={1}
          value={Math.round(minutes)}
          onChange={(e) => { setPlaying(false); setScrubbed(Number(e.target.value)); }}
          className="min-w-0 flex-1"
          style={{ accentColor: 'var(--accent)' }}
          aria-label="Time of day"
        />

        {scrubbed !== null && (
          <button
            type="button"
            onClick={() => { setPlaying(false); setScrubbed(null); }}
            className="tap shrink-0 px-3 text-[0.8125rem] font-semibold"
            style={{ borderRadius: 'var(--r-md)', color: 'var(--accent)' }}
          >
            Now
          </button>
        )}
          </div>

          <p className="text-[0.6875rem] leading-relaxed md:pt-1" style={{ color: 'var(--muted)' }}>
            Positions are <strong>scheduled</strong>, not tracked — BMRCL publishes no live
            feed, so nothing can show where a train actually is. At real speed a train crosses
            this map in about an hour, which is why there is a scrubber.
          </p>
        </div>
      </div>
      <div className="pb-3" />
    </section>
  );
}
