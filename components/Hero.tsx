import Image from 'next/image';
import type { CalendarOverrides, NetworkStatus } from '@/types/transit';
import Link from 'next/link';
import { Logo } from './Logo';
import { NetworkPulse } from './NetworkPulse';

/**
 * Dark "techflux" landing hero: near-black ground, violet light sources, a faint
 * engineering grid, and the platform photograph pushed right back as texture.
 *
 * This treatment is deliberately confined to the home page. The station pages
 * stay on the light palette because they are read one-handed outdoors, where a
 * dark saturated UI is the wrong choice.
 */
export function Hero({
  network, overrides, stats, children,
}: {
  network: NetworkStatus;
  overrides: CalendarOverrides;
  stats: Array<{ value: string; label: string }>;
  children: React.ReactNode;
}) {
  return (
    <section className="relative isolate">
      {/*
        Only the decorative layers are clipped. Putting overflow-hidden on the
        section itself also clipped the search suggestions, which have to be
        able to hang below the hero.
      */}
      <div className="glow-field absolute inset-0 -z-10 overflow-hidden" aria-hidden>
        {/* Photograph as texture, not subject: heavily darkened so the violet
            light sources above it stay the dominant colour. */}
        <Image
          src="/hero/platform.webp"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-[62%_center]"
          style={{ filter: 'saturate(0.55) brightness(0.52) contrast(1.05)' }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(to bottom, rgba(11,7,16,.50) 0%, rgba(11,7,16,.74) 52%, rgba(11,7,16,.98) 100%)',
          }}
        />
        <div className="grid-texture absolute inset-0" />
      </div>

      <div className="safe-top relative mx-auto w-full max-w-[64rem] px-5 pb-10 pt-5 md:px-8 md:pb-14 md:pt-8">
        {/* Logo sits opposite the live status, so the header reads as
            identity on one side and current state on the other. */}
        {/* Logo top-right, live status opposite it. On a phone they stack with
            the logo still leading the page. */}
        <div className="flex flex-wrap-reverse items-center justify-end gap-3 pb-8 md:pb-12">
          <div
            className="glass mr-auto inline-flex items-center gap-2 px-3 py-1.5"
            style={{ borderRadius: 999 }}
          >
            <NetworkPulse network={network} overrides={overrides} />
          </div>
          <Logo />
        </div>

        <Link
          href="/map"
          className="glass tap inline-flex items-center gap-2 px-3.5 text-[0.8125rem] font-semibold text-white"
          style={{ borderRadius: 999 }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M9 4.5 3.5 6.8v12.7L9 17.2l6 2.3 5.5-2.3V4.5L15 6.8z" />
            <path d="M9 4.5v12.7M15 6.8v12.7" />
          </svg>
          See the network map
        </Link>

        <h1 className="gradient-text mt-6 max-w-[15ch] text-balance text-[2.5rem] font-bold leading-[0.98] tracking-[-0.02em] md:text-[4.25rem]">
          Which train, which platform, where to park.
        </h1>

        <p className="mt-4 max-w-[48ch] text-[0.9375rem] leading-relaxed md:text-[1.0625rem]"
          style={{ color: 'var(--muted)' }}>
          Scheduled departures, station parking, connecting buses and what&rsquo;s within a walk —
          across all 83 stations on the Purple, Green and Yellow lines.
        </p>

        <div className="glass mt-8 max-w-[34rem] p-3" style={{ borderRadius: 'var(--r-md)' }}>
          {children}
        </div>

        <dl className="mt-10 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label}>
              <dt className="eyebrow order-2">{s.label}</dt>
              <dd
                className="num text-[1.625rem] font-semibold leading-none md:text-[2rem]"
                style={{
                  /*
                    The UI face, not the mono one used elsewhere for figures.
                    In monospace a comma takes a full character cell, so
                    "15,832" rendered as "15 , 832" — unnoticeable in a dense
                    column of departure times, and plainly a typo at display
                    size. `.num` keeps these tabular so the two columns of
                    stats still line up.
                  */
                  color: 'var(--accent)',
                  // A soft bloom so the numerals read as light rather than ink.
                  textShadow: '0 0 22px rgba(194,100,216,.45)',
                }}
              >
                {s.value}
              </dd>
              <dd className="sr-only">{s.label}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
