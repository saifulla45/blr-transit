'use client';

import { useEffect } from 'react';

/**
 * Inertial scrolling, and the clock that drives every scroll animation.
 *
 * This is the single change that most separates a site that feels built
 * from one that feels assembled, and it is almost invisible to describe:
 * the page carries momentum and settles instead of jumping a fixed number
 * of pixels per wheel notch. Every scroll-scrubbed animation then rides
 * that eased position rather than the raw one, which is why the drawing
 * and the train motion look continuous instead of stepped.
 *
 * Loaded dynamically and only on the landing page. A station page is read
 * standing on a platform with one hand, where hijacking the scroll is an
 * irritation rather than a flourish, and 48KB is not worth spending twice.
 *
 * Switched off entirely for prefers-reduced-motion: smoothing IS motion,
 * and for anyone who gets motion sick it is the worst offender on the page.
 */
export function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;
    // Touch devices already have native momentum; adding a second easing
    // layer on top fights the platform and feels laggy.
    if (window.matchMedia?.('(pointer: coarse)').matches) return undefined;

    let lenis: InstanceType<typeof import('lenis').default> | null = null;
    let frame = 0;
    let cancelled = false;

    (async () => {
      const [{ default: Lenis }, { gsap }, { ScrollTrigger }] = await Promise.all([
        import('lenis'),
        import('gsap'),
        import('gsap/ScrollTrigger'),
      ]);
      if (cancelled) return;

      gsap.registerPlugin(ScrollTrigger);

      lenis = new Lenis({
        duration: 1.05,
        // Exponential ease-out: quick to respond, long to settle.
        easing: (t: number) => Math.min(1, 1.001 - 2 ** (-10 * t)),
      });

      // ScrollTrigger must be told about the smoothed position or pinned
      // sections drift out of step with the content.
      lenis.on('scroll', ScrollTrigger.update);

      const raf = (time: number) => {
        lenis?.raf(time);
        frame = requestAnimationFrame(raf);
      };
      frame = requestAnimationFrame(raf);
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      lenis?.destroy();
    };
  }, []);

  return null;
}
