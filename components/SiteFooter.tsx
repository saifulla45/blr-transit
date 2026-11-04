import Link from 'next/link';
import { Credit } from './Credit';
import { LogoMark } from './Logo';

/**
 * The one footer every page shares: identity, the four links people look
 * for, the credit, then the page's own data attribution as fine print.
 */
export function SiteFooter({ children }: { children?: React.ReactNode }) {
  return (
    <footer className="safe-bottom relative mt-16" style={{ background: 'var(--surface)' }}>
      {/* A thin brand gradient as the footer's top edge. */}
      <div className="h-[3px] w-full" style={{ background: 'var(--brand-gradient)' }} aria-hidden />
      <div className="mx-auto w-full max-w-[72rem] px-5 pb-10 pt-8 md:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <span className="flex items-center gap-2">
            <LogoMark size={24} />
            <span className="text-[0.875rem] font-semibold tracking-[-0.02em]">Namma Commute</span>
          </span>
          <nav className="flex flex-wrap gap-x-5 gap-y-2 text-[0.8125rem]" style={{ color: 'var(--muted)' }}>
            <Link className="hover:underline" href="/map/">Network map</Link>
            <Link className="hover:underline" href="/about/">About &amp; data</Link>
            <Link className="hover:underline" href="/privacy/">Privacy</Link>
            {/* Trust needs a visible way to say "this is wrong". */}
            <Link className="hover:underline" href="/about/#corrections">Something wrong?</Link>
          </nav>
        </div>

        <p className="mt-6"><Credit /></p>
        <p className="mt-1 text-[0.8125rem]" style={{ color: 'var(--muted)' }}>
          Free, no ads, no tracking. Add it to your home screen to use it offline.
        </p>

        {children && (
          <div className="mt-6 text-[0.75rem] leading-relaxed" style={{ color: 'var(--muted)' }}>
            {children}
          </div>
        )}
      </div>
    </footer>
  );
}
