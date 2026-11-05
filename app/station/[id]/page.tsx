import { Suspense } from 'react';
import { toLite } from '@/types/transit';
import { notFound } from 'next/navigation';
import { OG_IMAGE } from '@/lib/site';
import { BusesPanel } from '@/components/BusesPanel';
import { DepartureBoard } from '@/components/DepartureBoard';
import { EntrancesPanel } from '@/components/EntrancesPanel';
import { FareLookup } from '@/components/FareLookup';
import { GettingHere } from '@/components/GettingHere';
import { LineStrip } from '@/components/LineStrip';
import { NearbyPanel } from '@/components/NearbyPanel';
import { ParkingPanel } from '@/components/ParkingPanel';
import { SectionNav } from '@/components/SectionNav';
import { AppBar } from '@/components/AppBar';
import { Orbs } from '@/components/Orbs';
import { SiteFooter } from '@/components/SiteFooter';
import { Reveal } from '@/components/Reveal';
import { SaveButton } from '@/components/SaveButton';
import { StationFacts } from '@/components/StationFacts';
import { StationMap } from '@/components/StationMap';
import { StickyNextTrain } from '@/components/StickyNextTrain';
import { Accessible, lineVar } from '@/components/primitives';
import { InterchangeIcon, TrainIcon } from '@/components/icons';
import {
  getBusesFor, getFareWindows, getFaresFrom, getJourneysFrom, getOverrides, getPasses,
  getPoisFor, getStationsIndex, getTimetable,
} from '@/lib/data';

export async function generateStaticParams() {
  const { stations } = await getStationsIndex();
  return stations.map((s) => ({ id: s.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { stations } = await getStationsIndex();
  const station = stations.find((s) => s.id === id);
  if (!station) return { title: 'Station not found' };

  const title = `${station.name} metro station`;
  const description =
    `Scheduled trains, parking, buses, fares and nearby places at ${station.name} `
    + 'metro station, Bengaluru.';

  return {
    title: station.name,
    description,
    alternates: { canonical: `/station/${station.id}/` },
    /*
      Set explicitly: `title` does not flow into og:title, so without this
      every one of the 83 station links shared on WhatsApp previewed as the
      generic site name. Station URLs are the ones people actually send each
      other, so this is the preview that matters most.
    */
    openGraph: {
      title,
      description,
      url: `/station/${station.id}/`,
      type: 'website' as const,
      // Repeated, not inherited — see OG_IMAGE.
      images: [OG_IMAGE],
    },
    twitter: { title, description, images: [OG_IMAGE.url] },
  };
}

export default async function StationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [{ stations, lines }, overrides, fareWindows, passes] = await Promise.all([
    getStationsIndex(), getOverrides(), getFareWindows(), getPasses(),
  ]);
  const station = stations.find((s) => s.id === id);
  if (!station) notFound();

  // Lean projection for the client components. The full array carries 235
  // entrances with coordinates, Kannada names and parking — none of which the
  // pickers, journey path or map need, and all of which would otherwise be
  // serialised into the page once per component that receives it.
  const stationsLite = stations.map(toLite);

  // Network maxima, so each station's parking bar is scaled against the
  // biggest lot rather than against itself.
  const maxTwoWheeler = Math.max(...stations.map((s) => s.parking?.twoWheeler ?? 0));
  const maxFourWheeler = Math.max(...stations.map((s) => s.parking?.fourWheeler ?? 0));

  const [timetable, fares, pois, buses, journeys] = await Promise.all([
    getTimetable(id), getFaresFrom(id), getPoisFor(id), getBusesFor(id), getJourneysFrom(id),
  ]);

  return (
    <>
    <AppBar
      overlay
      back={{ href: '/', label: 'All stations' }}
      title={station.name}
      right={<SaveButton stationId={station.id} name={station.name} />}
    />

    {/* The station's header on the aurora, lit by its own line colour. */}
    <section
      className="aurora -mt-[calc(3.5rem+max(0.5rem,env(safe-area-inset-top)))] overflow-x-clip"
      style={{
        backgroundImage: `radial-gradient(70% 80% at 0% 0%, color-mix(in srgb, ${lineVar(station.lines[0])} 35%, transparent), transparent 65%), linear-gradient(180deg, #011a1b 0%, #013536 45%, #0b5254 100%)`,
      }}
    >
      <Orbs />
      <header className="mx-auto w-full max-w-[34rem] px-5 pb-24 pt-[calc(5rem+env(safe-area-inset-top))] md:px-8 lg:max-w-[72rem]">
        <div className="flex items-center gap-2 pb-3">
          <span
            className="flex h-8 w-8 items-center justify-center"
            style={{
              borderRadius: 9,
              background: lineVar(station.lines[0]),
              color: '#fff',
              boxShadow: '0 0 0 2px rgba(255,255,255,.35)',
            }}
            aria-hidden
          >
            <TrainIcon size={17} />
          </span>
          <span className="text-[0.75rem] font-semibold uppercase tracking-[0.1em]" style={{ color: 'var(--muted)' }}>
            Metro station
          </span>
        </div>
        {/* Long names (Majestic's is 41 characters) step down a size rather
            than filling the first screen with three lines of title. */}
        <h1 className={`max-w-[46rem] text-balance leading-[1] ${
          station.name.length > 24 ? 'text-[2.25rem] md:text-[3.25rem]' : 'text-[3rem] md:text-[4.25rem]'}`}>
          {station.name}
        </h1>
        {/* BMRCL's own signage is bilingual; the feed ships the Kannada. */}
        {station.nameKn && (
          <p className="mt-1.5 text-[1.125rem] leading-tight" style={{ color: 'var(--muted)' }} lang="kn">
            {station.nameKn}
          </p>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {station.lines.map((l) => (
            <span key={l} className="frost flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.75rem] font-semibold">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: lineVar(l), boxShadow: '0 0 0 2px rgba(255,255,255,.6)' }} aria-hidden />
              {lines.find((x) => x.id === l)?.name ?? l} line
            </span>
          ))}
          {station.isInterchange && (
            <span className="frost flex items-center gap-1 rounded-full px-2.5 py-1 text-[0.75rem] font-semibold">
              <InterchangeIcon size={13} /> Interchange
            </span>
          )}
          {station.wheelchair && (
            <span className="frost flex items-center gap-1 rounded-full px-2.5 py-1 text-[0.75rem] font-semibold">
              <Accessible /> Step-free
            </span>
          )}
        </div>
        <div className="mt-4"><StationFacts station={station} /></div>
      </header>
    </section>

    <main className="page-lift mx-auto w-full max-w-[34rem] px-5 pb-28 pt-6 md:px-8 lg:max-w-[72rem]">
      <div className="max-w-[46rem] pb-6">
        <LineStrip station={station} lines={lines} stations={stationsLite} />
      </div>

      {/* Client-only: renders once a location is known. */}
      <div className="max-w-[46rem] empty:hidden [&:not(:empty)]:pb-6"><GettingHere station={station} /></div>

      <SectionNav hasBuses={buses.length > 0} />

      {/*
        One column on phones, two from lg.

        The split is by reading length, not by importance: Fare carries the
        full station-by-station journey and Nearby carries dozens of places, so
        they take one column each while the shorter panels stack in the other.
        Putting all five in source order would leave one column stranded.
      */}
      <div className="flex flex-col gap-4 pt-3 lg:grid lg:grid-cols-2 lg:items-start lg:gap-5">
        {/*
          Panels arrive as you reach them, staggered within each column.
          The delays are small and only inside a column — a long cascade
          down a page you are already reading is an obstacle, not a flourish.
        */}
        <div className="flex min-w-0 flex-col gap-4 lg:gap-5">
          <Reveal><Suspense fallback={null}><FareLookup
            origin={station}
            stations={stationsLite}
            lines={lines}
            fares={fares}
            journeys={journeys}
            fareWindows={fareWindows}
            overrides={overrides}
            timetable={timetable}
            passes={passes}
          /></Suspense></Reveal>
          <Reveal delay={60}><EntrancesPanel station={station} pois={pois} /></Reveal>
          <Reveal delay={120}><NearbyPanel pois={pois} stationName={station.name} /></Reveal>
        </div>

        <div className="flex min-w-0 flex-col gap-4 lg:gap-5">
          <Reveal><BusesPanel buses={buses} stationName={station.name} /></Reveal>
          <Reveal delay={60}>
            <div id="departures" className="scroll-mt-16">
              <DepartureBoard
                timetable={timetable}
                overrides={overrides}
                lines={lines}
                fareWindows={fareWindows}
                stationLat={station.lat}
                stationLon={station.lon}
              />
            </div>
          </Reveal>
          <Reveal delay={120}>
            <ParkingPanel
              station={station}
              maxTwoWheeler={maxTwoWheeler}
              maxFourWheeler={maxFourWheeler}
            />
          </Reveal>
          <Reveal delay={180}><StationMap station={station} lines={lines} pois={pois} /></Reveal>
        </div>
      </div>



    </main>
    {/* Outside <main>: page-lift leaves a transform on main, which would make
        this fixed bar scroll with the page instead of floating. */}
    <StickyNextTrain
      timetable={timetable}
      overrides={overrides}
      stationName={station.name}
      stationLat={station.lat}
      stationLon={station.lon}
    />
    <SiteFooter>
      Metro timetables Vonter/bmrcl-gtfs · buses Vonter/bmtc-gtfs (both ODbL 1.0) · parking
      BMRCL · places and map data © OpenStreetMap contributors
    </SiteFooter>
    </>
  );
}
