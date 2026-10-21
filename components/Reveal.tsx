'use client';

import { useEffect, useLayoutEffect, useRef } from 'react';

/**
 * Reveals its children as they scroll into view.
 *
 * Self-arming, after two earlier attempts failed in ways worth recording.
 *
 * The first hid everything via a `.js` class set by a blocking script.
 * React renders className on <html>, so hydration reconciled it against the
 * server markup and stripped the class — the script ran, the class vanished
 * a moment later, and every reveal shipped inert at transition-duration 0s
 * with nothing erroring or warning. Switching to a data attribute did not
 * help: React owns that element and strips what it did not render.
 *
 * So nothing global is relied on. Each instance hides ITSELF on mount, and
 * only if it is currently below the fold. That solves three problems at
 * once: no global flag to be stripped, no flash — an element that was never
 * painted cannot be seen disappearing — and anything already on screen
 * simply stays put, which is the right behaviour anyway, since content the
 * reader is already looking at should not fade out and back in.
 *
 * Without JavaScript nothing is ever armed, so every panel renders normally.
 */
export function Reveal({
  children,
  /** Stagger within a group, in milliseconds. */
  delay = 0,
  className = '',
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const armed = useRef(false);

  // Layout effect so the arming happens before the browser paints this
  // commit; a passive effect would let one frame through at full opacity.
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    // Only what is comfortably off screen. Anything visible stays visible.
    if (node.getBoundingClientRect().top > window.innerHeight * 0.9) {
      node.classList.add('reveal-armed');
      armed.current = true;
    }
  }, []);

  useEffect(() => {
    const node = ref.current;
    if (!node || !armed.current) return undefined;

    let done = false;
    const show = () => {
      if (done) return;
      done = true;
      node.classList.add('is-revealed');
      observer?.disconnect();
      window.removeEventListener('scroll', onScroll);
    };

    /*
      IntersectionObserver reports threshold CROSSINGS, so jumping down the
      page — an anchor to #departures, a restored scroll position, Cmd+End —
      leaves panels that went from below the fold to above it without ever
      intersecting, and they stay invisible permanently. Measured at 5 of 7.
      The scroll listener covers that; both detach on the first reveal.
    */
    function onScroll() {
      if (node!.getBoundingClientRect().top < window.innerHeight) show();
    }

    const observer = typeof IntersectionObserver === 'undefined' ? null
      : new IntersectionObserver(
        (entries) => { if (entries.some((e) => e.isIntersecting)) show(); },
        { rootMargin: '0px 0px -8% 0px', threshold: 0.05 },
      );

    if (!observer) { show(); return undefined; }
    observer.observe(node);
    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  return (
    <div
      ref={ref}
      className={`reveal ${className}`}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}
