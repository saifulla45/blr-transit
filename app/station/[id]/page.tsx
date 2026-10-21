import Link from 'next/link';
import { Suspense } from 'react';
import { toLite } from '@/types/transit';
import { notFound } from 'next/navigation';
import { OG_IMAGE } from '@/lib/site';
import { BusesPanel } from '@/components/BusesPanel';
import { DepartureBoard } from '@/components/DepartureBoard';
import { EntrancesPanel } from '@/components/EntrancesPanel';
import { FareLookup } from '@/components/FareLookup';
import { LineStrip } from '@/components/LineStrip';
import { NearbyPanel } from '@/components/NearbyPanel';
import { ParkingPanel } from '@/components/ParkingPanel';
import { SectionNav } from '@/components/SectionNav';
import { Credit } from '@/components/Credit';
import { SaveButton } from '@/components/SaveButton';
import { StationFacts } from '@/components/StationFacts';
import { StationMap } from '@/components/StationMap';
import { StickyNextTrain } from '@/components/StickyNextTrain';
import { Accessible, LineTag, lineVar } from '@/components/primitives';
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
    <main className="mx-auto w-full max-w-[34rem] px-5 pb-28 md:px-8 lg:max-w-[72rem]">
      {/* A band in the station's own line colour, so the page has an identity
          the moment it loads rather than opening on undifferentiated text. */}
      <div
        className="-mx-5 h-1 md:-mx-8"
        style={{
          background: `linear-gradient(to right, ${station.lines
            .map((l) => lineVar(l))
            .join(', ')})`,
        }}
        aria-hidden
      />

      <nav className="safe-top pb-3 pt-3">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-[0.8125rem]"
          style={{ color: 'var(--muted)' }}
        >
          <span aria-hidden>←</span> All stations
        </Link>
      </nav>

      <header className="max-w-[46rem] pb-5">
        <div className="flex items-start gap-2.5">
          {/* A metro glyph in the station's own line colour, so the page is
              identifiable at a glance rather than opening on plain text. */}
          <span className="mt-1 shrink-0" style={{ color: lineVar(station.lines[0]) }}>
            <TrainIcon size={26} />
          </span>
          <div className="min-w-0">
            <h1 className="text-balance text-[1.875rem] font-bold leading-tight tracking-tight">
              {station.name}
            </h1>
            {/* BMRCL's own signage is bilingual; the feed ships the Kannada. */}
            {station.nameKn && (
              <p className="mt-1 text-[1rem] leading-tight" style={{ color: 'var(--muted)' }}>
                {station.nameKn}
              </p>
            )}
          </div>
        </div>
        <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1.5">
          {station.lines.map((l) => <LineTag key={l} line={l} lines={lines} />)}
          {station.isInterchange && (
            <span className="eyebrow flex items-center gap-1" style={{ color: 'var(--accent)' }}>
              <InterchangeIcon size={13} /> Interchange
            </span>
          )}
          {station.wheelchair && (
            <span className="eyebrow flex items-center gap-1" style={{ color: 'var(--muted)' }}>
              <Accessible /> Step-free
            </span>
          )}
          <span className="ml-auto"><SaveButton stationId={station.id} name={station.name} /></span>
        </div>
        <StationFacts station={station} />
      </header>

      <div className="max-w-[46rem] pb-6">
        <LineStrip station={station} lines={lines} stations={stationsLite} />
      </div>

      <SectionNav hasBuses={buses.length > 0} />

      {/*
        One column on phones, two from lg.

        The split is by reading length, not by importance: Fare carries the
        full station-by-station journey and Nearby carries dozens of places, so
        they take one column each while the shorter panels stack in the other.
        Putting all five in source order would leave one column stranded.
      */}
      <div className="flex flex-col gap-4 pt-3 lg:grid lg:grid-cols-2 lg:items-start lg:gap-5">
        <div className="flex min-w-0 flex-col gap-4 lg:gap-5">
          <Suspense fallback={null}><FareLookup
            origin={station}
            stations={stationsLite}
            lines={lines}
            fares={fares}
            journeys={journeys}
            fareWindows={fareWindows}
            overrides={overrides}
            timetable={timetable}
            passes={passes}
          /></Suspense>
          <EntrancesPanel station={station} />
          <NearbyPanel pois={pois} stationName={station.name} />
        </div>

        <div className="flex min-w-0 flex-col gap-4 lg:gap-5">
          <BusesPanel buses={buses} stationName={station.name} />
          <div id="departures" className="scroll-mt-16">
            <DepartureBoard
              timetable={timetable}
              overrides={overrides}
              lines={lines}
              fareWindows={fareWindows}
            />
          </div>
          <ParkingPanel
            station={station}
            maxTwoWheeler={maxTwoWheeler}
            maxFourWheeler={maxFourWheeler}
          />
          <StationMap station={station} lines={lines} pois={pois} />
        </div>
      </div>

      <StickyNextTrain timetable={timetable} overrides={overrides} stationName={station.name} />

      <footer
        className="mt-10 pt-5 text-[0.75rem] leading-relaxed"
        style={{ borderTop: '1px solid var(--rule)', color: 'var(--muted)' }}
      >
        <p>
          Metro timetables Vonter/bmrcl-gtfs · buses Vonter/bmtc-gtfs (both ODbL 1.0) · parking
          BMRCL · places and map data © OpenStreetMap contributors
        </p>
        <p className="mt-2"><Credit /></p>
      </footer>
    </main>
  );
}
