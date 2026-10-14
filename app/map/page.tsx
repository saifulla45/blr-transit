import Link from 'next/link';
import type { Metadata } from 'next';
import { NetworkMap } from '@/components/NetworkMap';
import { LineTag } from '@/components/primitives';
import { Credit } from '@/components/Credit';
import { getStationsIndex } from '@/lib/data';

export const metadata: Metadata = {
  title: 'Network map — Namma Commute',
  description: 'The whole Namma Metro network: Purple, Green and Yellow lines, all 83 stations.',
};

export default async function MapPage() {
  const { stations, lines } = await getStationsIndex();

  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-[72rem] flex-col px-5 pb-6 md:px-8">
      <nav className="safe-top pb-3 pt-3">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-[0.8125rem]"
          style={{ color: 'var(--muted)' }}
        >
          <span aria-hidden>←</span> Home
        </Link>
      </nav>

      <header className="flex flex-wrap items-baseline justify-between gap-3 pb-4">
        <h1 className="text-[1.75rem] font-bold tracking-tight">Network map</h1>
        <span className="flex flex-wrap gap-1.5">
          {lines.map((l) => <LineTag key={l.id} line={l.id} lines={lines} />)}
        </span>
      </header>

      {/* A definite height, not flex-1: the map needs a resolved height at the
          moment it initialises or it sizes itself to zero. */}
      <NetworkMap
        stations={stations}
        lines={lines}
        className="h-[72vh] min-h-[420px] overflow-hidden"
      />

      <p className="safe-bottom pt-3 text-[0.75rem]" style={{ color: 'var(--muted)' }}>
        Tap a station to open it. Larger circles are interchanges. Geometry from BMRCL via
        Vonter/bmrcl-gtfs, map data © OpenStreetMap contributors. <Credit />
      </p>
    </main>
  );
}
