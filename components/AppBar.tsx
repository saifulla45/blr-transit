'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Logo, LogoMark } from './Logo';

/**
 * The one header every page shares.
 *
 * Sticky and translucent; a hairline and the page title appear once the
 * page scrolls, so the bar is invisible at the top and orienting further
 * down. Before this every page had its own header: a logo row on the home
 * page, a back arrow on stations, "← Home" on the map and an underlined
 * link on About.
 */
export function AppBar({
  back, title, right, overlay = false,
}: {
  /** Sits transparent over a coloured header until the page scrolls. */
  overlay?: boolean;
  /** Adds a back button; the logo stays beside it as the way home. */
  back?: { href: string; label: string };
  /** Fades in at the centre once scrolled. */
  title?: string;
  right?: React.ReactNode;
}) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`safe-top sticky top-0 z-40 transition-[background-color,border-color] duration-300 ${
        overlay && !scrolled ? 'on-colour' : 'glass'}`}
      style={{
        borderBottom: `1px solid ${scrolled ? 'var(--rule)' : 'transparent'}`,
      }}
    >
      <div className="mx-auto flex h-14 w-full max-w-[72rem] items-center gap-3 px-4 md:px-8">
        {back && (
          <Link href={back.href} className="icon-btn press !h-9 !w-9 shrink-0" aria-label={back.label}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M15 6l-6 6 6 6" />
            </svg>
          </Link>
        )}
        {/* Always present and always home. Beside a back button only the mark
            fits once the page title appears, so the wordmark gives way then. */}
        <Link href="/" className="press flex shrink-0 items-center" aria-label="Namma Commute home">
          {back ? (
            <span className="flex items-center gap-2">
              <LogoMark size={36} />
              <span className={`text-[1rem] font-bold tracking-[-0.015em] transition-opacity duration-300 ${
                scrolled && title ? 'hidden' : ''}`}>
                Namma Commute
              </span>
            </span>
          ) : (
            <Logo />
          )}
        </Link>

        <span
          className="min-w-0 flex-1 truncate text-center text-[0.9375rem] font-semibold tracking-[-0.01em] transition-all duration-300"
          style={{ opacity: scrolled && title ? 1 : 0, transform: scrolled ? 'none' : 'translateY(4px)' }}
          aria-hidden={!scrolled}
        >
          {title}
        </span>

        <div className="flex shrink-0 items-center gap-2">
          {right ?? (
            <Link href="/map" className="icon-btn press !h-9 !w-9" aria-label="Network map">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M9 4.5 3.5 6.8v12.7L9 17.2l6 2.3 5.5-2.3V4.5L15 6.8z" />
                <path d="M9 4.5v12.7M15 6.8v12.7" />
              </svg>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
