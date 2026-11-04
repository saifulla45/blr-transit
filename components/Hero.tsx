import type { CalendarOverrides, NetworkStatus } from '@/types/transit';
import { NetworkPulse } from './NetworkPulse';
import { Orbs } from './Orbs';

/**
 * Landing hero: deep teal with two glass orbs of light, one centred serif
 * line of purpose and the two ways in. The network totals moved out: the
 * scroll drawing further down tells them, and here they pushed the answer
 * below the fold.
 *
 * Pulled up under the transparent app bar so the colour starts at the very
 * top of the screen.
 */
export function Hero({
  network, overrides, children,
}: {
  network: NetworkStatus;
  overrides: CalendarOverrides;
  children: React.ReactNode;
}) {
  return (
    <section className="aurora -mt-[calc(3.5rem+max(0.5rem,env(safe-area-inset-top)))] overflow-x-clip">
      <Orbs />

      <div className="relative mx-auto flex w-full max-w-[64rem] flex-col items-center px-5 pb-16 pt-[calc(5.5rem+env(safe-area-inset-top))] text-center md:px-8 md:pb-24 md:pt-32">
        <div className="frost inline-flex max-w-full items-center rounded-full px-3.5 py-1.5 text-left">
          <NetworkPulse network={network} overrides={overrides} />
        </div>

        <h1 className="mt-6 max-w-[13ch] text-balance text-[2.875rem] leading-[0.98] tracking-[-0.03em] md:text-[5.5rem]">
          Your metro,{' '}
          <span className="headline-em">beautifully</span> sorted.
        </h1>

        <p className="mt-5 max-w-[36ch] text-[1rem] leading-relaxed md:text-[1.125rem]"
          style={{ color: 'var(--muted)' }}>
          Next trains, fares, parking, buses and the ride to the station — every Namma Metro stop.
        </p>

        <div className="frost mt-9 w-full max-w-[36rem] rounded-[var(--r-lg)] p-2.5 text-left md:p-3"
          style={{ boxShadow: '0 30px 60px -28px rgba(0, 0, 0, .6)' }}>
          {children}
        </div>
      </div>
    </section>
  );
}
