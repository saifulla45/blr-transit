'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Counts a figure up to its value when it first appears.
 *
 * Earns its place rather than decorating: 15,832 parking spaces is a number
 * nobody reads as a quantity when it simply appears. Watching it climb makes
 * the size register, which is the only reason the figure is on the page.
 *
 * Driven by requestAnimationFrame against a real clock rather than a
 * per-frame increment, so the duration holds on a slow device instead of
 * stretching out.
 *
 * Reformats through the same en-IN grouping as the final value, so there is
 * no moment where the digits are ungrouped and the width jumps.
 */
export function CountUp({
  value,
  durationMs = 1100,
  className = '',
  style,
}: {
  /** The final rendered string, e.g. "15,832" or "Free". */
  value: string;
  durationMs?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  // Anything that is not a plain number is shown as-is — "Free" cannot count.
  const target = Number(value.replace(/[^0-9]/g, ''));
  const countable = /^[\d,]+$/.test(value.trim()) && Number.isFinite(target) && target > 0;

  // Only meaningful while counting; a non-countable value renders directly
  // rather than being copied into state by an effect.
  const [display, setDisplay] = useState('0');
  const ref = useRef<HTMLSpanElement | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (!countable) return undefined;
    const node = ref.current;
    if (!node) return undefined;

    /*
      Respected here as well as in CSS, because the animation is JS-driven
      and the global reduced-motion rule cannot reach it. Expressed as a
      zero duration rather than an early setState: the first frame then
      computes progress 1 and lands on the final figure, which keeps every
      state change inside requestAnimationFrame.
    */
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const ms = reduced ? 0 : durationMs;

    let raf = 0;
    const run = () => {
      if (started.current) return;
      started.current = true;
      const t0 = performance.now();
      const tick = (t: number) => {
        const p = ms <= 0 ? 1 : Math.min(1, (t - t0) / ms);
        // Ease-out cubic: fast at first, settling onto the real figure,
        // which reads as a number arriving rather than a slot machine.
        const eased = 1 - (1 - p) ** 3;
        setDisplay(Math.round(target * eased).toLocaleString('en-IN'));
        if (p < 1) raf = requestAnimationFrame(tick);
        else setDisplay(value);
      };
      raf = requestAnimationFrame(tick);
    };

    if (typeof IntersectionObserver === 'undefined') { run(); return undefined; }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { run(); observer.disconnect(); }
    }, { threshold: 0.4 });
    observer.observe(node);

    return () => { observer.disconnect(); cancelAnimationFrame(raf); };
  }, [value, countable, target, durationMs]);

  return (
    <span ref={ref} className={className} style={style}>
      {/* The final value is what a screen reader and a crawler get; the
          intermediate frames are noise to anything not watching. */}
      <span aria-hidden>{countable ? display : value}</span>
      <span className="sr-only">{value}</span>
    </span>
  );
}
