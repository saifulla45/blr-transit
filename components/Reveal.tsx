'use client';

import { useEffect, useRef } from 'react';

/**
 * Reveals its children as they scroll into view.
 *
 * The no-JavaScript trap this avoids: the obvious implementation starts at
 * opacity 0 and animates up, which means anyone whose JS fails — or a
 * crawler — gets a blank page. So the hidden state is scoped to `.js`, a
 * class set by a blocking inline script in the head. The class lands before
 * first paint, so there is no flash of visible content either.
 *
 * IntersectionObserver rather than a scroll handler: no work on frames where
 * nothing crosses the threshold, and the browser does the maths off the main
 * thread. Each element is unobserved once shown, so a long station page is
 * not still watching thirty nodes by the time you reach the bottom.
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

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;

    // Older Safari and anything without the API keeps the content visible
    // rather than losing it.
    if (typeof IntersectionObserver === 'undefined') {
      node.classList.add('is-revealed');
      return undefined;
    }

    let done = false;
    const reveal = () => {
      if (done) return;
      done = true;
      node.classList.add('is-revealed');
      observer.disconnect();
      window.removeEventListener('scroll', onScroll);
    };

    /*
      The observer alone is not enough, and the failure is silent.

      IntersectionObserver reports threshold CROSSINGS. Jump straight down
      the page — an anchor link to #departures, a restored scroll position,
      Cmd+End — and a panel goes from below the viewport to above it without
      ever intersecting, so no callback fires and it stays invisible
      forever. Measured: 5 of 7 panels after an instant jump, 7 of 7 when
      scrolling normally.

      So a passive scroll listener backs it up, revealing anything that is
      no longer below the fold. Both paths remove themselves on the first
      reveal, so nothing is left listening.
    */
    function onScroll() {
      if (node!.getBoundingClientRect().top < window.innerHeight) reveal();
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) reveal();
      },
      // Fires a little before the element arrives, so the motion finishes
      // about when it reaches comfortable reading position.
      { rootMargin: '0px 0px -8% 0px', threshold: 0.05 },
    );

    observer.observe(node);
    window.addEventListener('scroll', onScroll, { passive: true });
    // Covers a page that loads already scrolled, before any scroll event.
    onScroll();

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
