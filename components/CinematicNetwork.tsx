'use client';

import { useEffect, useRef, useState } from 'react';
import { countRunning, project, type LiveNetwork } from '@/lib/livePositions';
import { nowInBengaluru, servicePatternFor } from '@/lib/time';
import type { CalendarOverrides } from '@/types/transit';
import { lineVar } from './primitives';

/**
 * The network drawing itself, scrubbed to the scroll.
 *
 * The one place on this site where scrolling IS the content rather than a
 * way of reaching it. The section pins, the three lines draw from their
 * termini, a train runs the Purple line, and three captions take turns —
 * all of it tied to scroll position, so it runs forwards when you scroll
 * down and backwards when you scroll up. Nothing plays on a timer, which
 * is the difference between choreography and a GIF.
 *
 * Built from the same station coordinates as the live map, so it is the
 * real network being drawn rather than an illustration of one.
 *
 * Confined to the landing page, which is a different job from the rest of
 * the site: the station pages stay quick and flat because someone is
 * reading them on a platform.
 *
 * Degrades to a static drawing of the finished network when JavaScript is
 * unavailable or the reader prefers reduced motion — the SVG is in the
 * markup either way, only the scrubbing is conditional.
 */

/**
 * The third caption carries the live train count.
 *
 * It is the one fact worth keeping from the separate "trains running now"
 * panel this section replaced — two near-identical maps on one page was a
 * duplication, but the count was the part doing real work. Folding it into
 * a caption keeps the figure without bringing the panel back.
 */
function captions(running: number | null) {
  return [
    { title: '3 lines', body: 'Purple, Green and Yellow, end to end.' },
    { title: '83 stations', body: 'Every one with departures, fares and parking.' },
    running === null || running === 0
      ? { title: 'Every departure', body: 'Scheduled times, straight from BMRCL’s timetable.' }
      : {
        title: `${running} trains running`,
        body: 'Scheduled positions right now, from BMRCL’s own timetable.',
      },
  ];
}

/*
  Caption windows on the scroll timeline, in timeline seconds.

  Spaced so one has finished leaving before the next arrives. The first
  version overlapped — two captions sat at 27% opacity simultaneously,
  stacked in the same absolute position, which reads as a rendering fault
  rather than a crossfade.
*/
const CAPTION_START = 0.3;
const CAPTION_GAP = 0.85;
const CAPTION_FADE = 0.18;
const CAPTION_HOLD = 0.45;

export function CinematicNetwork({
  net, overrides,
}: {
  net: LiveNetwork;
  overrides: CalendarOverrides;
}) {
  const root = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Null until mounted: the server has no Bengaluru clock, so a count
  // rendered there would disagree with the client and flash on hydration.
  const [running, setRunning] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => {
      const now = nowInBengaluru();
      setRunning(countRunning(net, servicePatternFor(now.date, overrides, now.weekday), now.minutes));
    };
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [net, overrides]);

  const CAPTIONS = captions(running);

  const all = net.lines.flatMap((l) => l.stations);
  const { toXY, aspect } = project(all);
  const boxH = Math.round(1000 * Math.min(1.1, Math.max(0.5, aspect)));

  const PAD = 0.07;
  const sx = (x: number) => (PAD + x * (1 - PAD * 2)) * 1000;
  const sy = (y: number) => (PAD * (boxH / 1000) + y * (1 - PAD * 2)) * 1000;

  const paths = net.lines.map((line) => ({
    id: line.id,
    d: line.stations
      .map((s, i) => {
        const p = toXY(s.lat, s.lon);
        return `${i === 0 ? 'M' : 'L'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`;
      })
      .join(''),
  }));

  useEffect(() => {
    const node = root.current;
    const svg = svgRef.current;
    if (!node || !svg) return undefined;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;

    let ctx: { revert: () => void } | null = null;
    let resize: ResizeObserver | null = null;
    let cancelled = false;

    (async () => {
      const [{ gsap }, { ScrollTrigger }] = await Promise.all([
        import('gsap'),
        import('gsap/ScrollTrigger'),
      ]);
      if (cancelled) return;
      gsap.registerPlugin(ScrollTrigger);

      // gsap.context scopes every selector and gives one revert() for
      // cleanup, which matters because React can mount this twice in dev.
      ctx = gsap.context(() => {
        const lines = gsap.utils.toArray<SVGPathElement>('.cine-line');
        const dots = gsap.utils.toArray<SVGCircleElement>('.cine-stop');
        const train = svg.querySelector<SVGCircleElement>('.cine-train');
        const trail = svg.querySelector<SVGPathElement>('.cine-trail');

        // Each line starts fully retracted; drawing is the dash offset
        // travelling back to zero.
        lines.forEach((p) => {
          const len = p.getTotalLength();
          gsap.set(p, { strokeDasharray: len, strokeDashoffset: len });
        });
        gsap.set(dots, { opacity: 0, scale: 0, transformOrigin: 'center' });

        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: node,
            start: 'top top',
            end: '+=180%',
            // Pinned, so the drawing holds still while the scroll drives it.
            pin: true,
            // A number rather than `true`: the catch-up smooths the step
            // that a mouse wheel delivers.
            scrub: 0.8,
            anticipatePin: 1,
          },
        });

        lines.forEach((p, i) => {
          tl.to(p, { strokeDashoffset: 0, ease: 'none', duration: 1 }, i * 0.18);
        });

        // Stations pop in behind the advancing line, not all at once.
        tl.to(dots, {
          opacity: 1, scale: 1, ease: 'back.out(2)', duration: 0.45,
          stagger: { each: 0.012, from: 'start' },
        }, 0.35);

        if (train && trail) {
          const len = trail.getTotalLength();
          tl.to({ p: 0 }, {
            p: 1,
            ease: 'none',
            duration: 1.4,
            onUpdate(this: { targets: () => Array<{ p: number }> }) {
              const { p } = this.targets()[0];
              const pt = trail.getPointAtLength(len * p);
              gsap.set(train, { attr: { cx: pt.x, cy: pt.y }, opacity: p > 0.01 ? 1 : 0 });
            },
          }, 0.6);
        }

        gsap.utils.toArray<HTMLElement>('.cine-caption').forEach((cap, i) => {
          const start = CAPTION_START + i * CAPTION_GAP;
          tl.fromTo(cap,
            { opacity: 0, y: 26 },
            { opacity: 1, y: 0, duration: CAPTION_FADE, ease: 'power2.out' }, start)
            .to(cap, { opacity: 0, y: -26, duration: CAPTION_FADE, ease: 'power2.in' },
              start + CAPTION_FADE + CAPTION_HOLD);
        });
      }, node);

      // Cards above this section arrive after load (the ride card once a
      // fix lands), which moves the pin's start; without a refresh the pin
      // fires at the old offset and covers whatever now sits there.
      let raf = 0;
      resize = new ResizeObserver(() => {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => ScrollTrigger.refresh());
      });
      resize.observe(document.body);
    })();

    return () => { cancelled = true; resize?.disconnect(); ctx?.revert(); };
  }, []);

  const purple = paths.find((p) => p.id === 'PURPLE') ?? paths[0];

  return (
    <div ref={root} className="relative isolate overflow-hidden" style={{ background: 'var(--ground)' }}>
      <div className="relative mx-auto flex min-h-[100svh] w-full max-w-[72rem] items-center justify-center px-5 py-10 md:px-8">
        <svg
          ref={svgRef}
          viewBox={`0 0 1000 ${boxH}`}
          className="w-full"
          style={{ maxHeight: '78svh' }}
          role="img"
          aria-label="The Namma Metro network: three lines and 83 stations"
        >
          <defs>
            <filter id="cineGlow" x="-120%" y="-120%" width="340%" height="340%">
              <feGaussianBlur stdDeviation="9" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          {paths.map((p) => (
            <g key={p.id}>
              <path d={p.d} fill="none" stroke={lineVar(p.id as never)} strokeWidth={14}
                opacity={0.14} strokeLinecap="round" strokeLinejoin="round" />
              <path className="cine-line" d={p.d} fill="none" stroke={lineVar(p.id as never)}
                strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
            </g>
          ))}

          {/* Invisible guide the train is positioned along. */}
          <path className="cine-trail" d={purple.d} fill="none" stroke="none" />

          {net.lines.flatMap((line) => line.stations.map((s) => {
            const p = toXY(s.lat, s.lon);
            return (
              <circle
                key={`${line.id}-${s.id}`}
                className="cine-stop"
                cx={sx(p.x)}
                cy={sy(p.y)}
                r={4}
                fill="var(--ground)"
                stroke={lineVar(line.id as never)}
                strokeWidth={2}
              />
            );
          }))}

          <circle className="cine-train" cx={0} cy={0} r={9} opacity={0}
            fill="var(--line-PURPLE, #c264d8)" filter="url(#cineGlow)" />
        </svg>

        <div className="pointer-events-none absolute inset-x-5 bottom-10 md:inset-x-8 md:bottom-14">
          {CAPTIONS.map((c) => (
            <div
              key={c.title}
              className="cine-caption absolute inset-x-0 bottom-0"
              style={{ opacity: 0 }}
            >
              <p className="display text-[2.75rem] leading-none md:text-[4.5rem]">
                {c.title}
              </p>
              <p className="mt-2 text-[0.9375rem] md:text-[1.125rem]" style={{ color: 'var(--muted)' }}>
                {c.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
