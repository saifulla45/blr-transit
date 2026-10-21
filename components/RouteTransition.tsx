'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Navigation feedback: a progress bar on the way out, a settle on the way in.
 *
 * Every page here is prerendered, so on a good connection a station page
 * arrives almost instantly and this is barely seen. On a patchy one the RSC
 * payload and the station's own data take real time, and the page sat
 * completely still in the meantime — no spinner, no bar, nothing — which
 * reads as a dead tap. That is the case this exists for.
 *
 * Two halves:
 *
 * The bar starts on a click of an internal link, not on the pathname
 * changing. The pathname only changes once the next route is ready, which
 * is precisely the moment the waiting ENDS — a bar that appears then would
 * be theatre. It eases towards 90% and never reaches it on its own, because
 * a bar that completes while you are still waiting is a lie.
 *
 * The content then fades and lifts into place, keyed on the pathname so it
 * replays per navigation. Short — 380ms — because this is a utility and the
 * transition must not become the slowest part of arriving.
 */
export function RouteTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Start on a click of any same-origin link that actually navigates.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      // Modified clicks open a new tab; this page is not going anywhere.
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      const link = (e.target as HTMLElement | null)?.closest?.('a');
      if (!link) return;

      const href = link.getAttribute('href');
      if (!href || href.startsWith('#') || link.target === '_blank') return;

      const url = new URL(href, window.location.href);
      if (url.origin !== window.location.origin) return;
      // Same page, or only the query changed — the planner does that on
      // every pick and a bar flashing each time would be noise.
      if (url.pathname === window.location.pathname) return;

      setLoading(true);
      setProgress(8);
    };

    document.addEventListener('click', onClick, { capture: true });
    return () => document.removeEventListener('click', onClick, { capture: true });
  }, []);

  // Creep towards 90% while waiting; never arrive without the page.
  useEffect(() => {
    if (!loading) return undefined;
    timer.current = setInterval(() => {
      setProgress((p) => (p >= 90 ? p : p + Math.max(0.5, (90 - p) * 0.08)));
    }, 90);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [loading]);

  /*
    Arrival: fill, then disappear.

    Both state changes are scheduled rather than set synchronously in the
    effect body — the direct version trips react-hooks/set-state-in-effect,
    and correctly, since it forces a second render pass before paint. A
    frame's delay is imperceptible here and the bar animates to 100% either
    way.
  */
  useEffect(() => {
    if (!loading) return undefined;
    const fill = requestAnimationFrame(() => setProgress(100));
    const clear = setTimeout(() => { setLoading(false); setProgress(0); }, 280);
    return () => { cancelAnimationFrame(fill); clearTimeout(clear); };
    // Deliberately keyed on pathname only: this is the arrival signal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <>
      {loading && (
        <div
          role="progressbar"
          aria-label="Loading page"
          aria-valuenow={Math.round(progress)}
          aria-valuemin={0}
          aria-valuemax={100}
          className="pointer-events-none fixed inset-x-0 top-0 z-50 h-[3px]"
        >
          <div
            className="h-full origin-left"
            style={{
              width: `${progress}%`,
              background: 'linear-gradient(90deg, var(--line-PURPLE, #c264d8), var(--line-GREEN, #45cf78), var(--line-YELLOW, #e8c552))',
              boxShadow: '0 0 12px color-mix(in srgb, var(--accent) 70%, transparent)',
              transition: 'width 220ms cubic-bezier(.22,.61,.36,1), opacity 200ms',
              opacity: progress >= 100 ? 0 : 1,
            }}
          />
        </div>
      )}

      {/* Keyed so the entrance replays on each navigation. */}
      <div key={pathname} className="route-enter">{children}</div>
    </>
  );
}
