import type { Metadata } from 'next';
import { NetworkMap } from '@/components/NetworkMap';
import { lineVar } from '@/components/primitives';
import { AppBar } from '@/components/AppBar';
import { PageHeader } from '@/components/PageHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { getStationsIndex } from '@/lib/data';

export const metadata: Metadata = {
  title: 'Network map',
  description: 'The whole Namma Metro network: Purple, Green and Yellow lines, all 83 stations.',
};

export default async function MapPage() {
  const { stations, lines } = await getStationsIndex();

  return (
    <>
    <AppBar overlay back={{ href: '/', label: 'Home' }} title="Network map" right={<span />} />
    <PageHeader eyebrow={`${stations.length} stations · ${lines.length} lines`} title="Network map">
      <div className="mt-4 flex flex-wrap gap-2">
        {lines.map((l) => (
          <span key={l.id} className="frost flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.75rem] font-semibold">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: lineVar(l.id), boxShadow: '0 0 0 2px rgba(255,255,255,.6)' }} aria-hidden />
            {l.name} line
          </span>
        ))}
      </div>
    </PageHeader>
    <main className="mx-auto flex w-full max-w-[72rem] flex-col px-5 pb-6 pt-6 md:px-8">

      {/* A definite height, not flex-1: the map needs a resolved height at the
          moment it initialises or it sizes itself to zero. */}
      <NetworkMap
        stations={stations}
        lines={lines}
        className="card h-[72vh] min-h-[420px] overflow-hidden"
      />

      <p className="pt-3 text-[0.8125rem]" style={{ color: 'var(--muted)' }}>
        Tap a station to open it. Larger circles are interchanges.
      </p>
    </main>
    <SiteFooter>
      Geometry from BMRCL via Vonter/bmrcl-gtfs, map data © OpenStreetMap contributors.
    </SiteFooter>
    </>
  );
}
