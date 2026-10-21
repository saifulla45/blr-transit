import Link from 'next/link';
import { Browse } from '@/components/Browse';
import { Credit } from '@/components/Credit';
import {
  getFareWindows, getLiveNetwork, getNetwork, getOverrides, getStationsIndex,
} from '@/lib/data';

export default async function HomePage() {
  const [{ stations, lines, feedVersion }, overrides, network, fareWindows, live] =
    await Promise.all([
      getStationsIndex(), getOverrides(), getNetwork(), getFareWindows(), getLiveNetwork(),
    ]);
  const withParking = stations.filter((s) => s.parking).length;
  const twoWheeler = stations.reduce((n, s) => n + (s.parking?.twoWheeler ?? 0), 0);
  const fourWheeler = stations.reduce((n, s) => n + (s.parking?.fourWheeler ?? 0), 0);

  const stats = [
    { value: String(stations.length), label: 'Stations' },
    { value: String(lines.length), label: 'Lines' },
    { value: twoWheeler.toLocaleString('en-IN'), label: 'Two-wheeler spaces' },
    { value: fourWheeler.toLocaleString('en-IN'), label: 'Four-wheeler spaces' },
  ];

  return (
    // The landing page is dark end to end; the station pages are not.
    <main className="surface-dark min-h-[100dvh]">
      {/* Browse owns the hero because the locate/search controls inside it share
          state with the results below. */}
      <Browse
        stations={stations}
        lines={lines}
        network={network}
        overrides={overrides}
        stats={stats}
        fareWindows={fareWindows}
        live={live}
      />

      <section className="mx-auto w-full max-w-[64rem] px-5 pb-14 md:px-8">
        <footer
          className="safe-bottom mt-10 pt-5 text-[0.75rem] leading-relaxed"
          style={{ borderTop: '1px solid var(--rule)', color: 'var(--muted)' }}
        >
          {/*
            Credit and navigation first, licence text last. Reversed, the
            byline landed after three paragraphs of attribution where nobody
            scrolled far enough to read it.
          */}
          <p className="pb-3"><Credit /></p>

          <p className="flex flex-wrap gap-x-4 gap-y-1 pb-4">
            <Link className="underline" href="/about/">About &amp; data sources</Link>
            <Link className="underline" href="/privacy/">Privacy</Link>
            <Link className="underline" href="/map/">Network map</Link>
            {/* Trust needs a visible way to say "this is wrong". The data is
                open, so corrections go upstream and fix it for everyone. */}
            <Link className="underline" href="/about/#corrections">Something wrong?</Link>
          </p>

          <p>
            Parking capacity for {withParking} of {stations.length} stations, from BMRCL. Train
            times are <strong>scheduled</strong>, from BMRCL&rsquo;s published timetable (feed{' '}
            <span className="num" style={{ fontFamily: 'var(--font-mono), monospace' }}>
              {feedVersion}
            </span>
            ) — BMRCL publishes no live feed, so nothing here is realtime.
          </p>
          <p className="mt-2">
            Timetables{' '}
            <a className="underline" href="https://github.com/Vonter/bmrcl-gtfs">Vonter/bmrcl-gtfs</a>{' '}
            (ODbL 1.0) · parking{' '}
            <a className="underline" href="https://english.bmrc.co.in/parking/">BMRCL</a> · places
            and map data © OpenStreetMap contributors · hero photograph{' '}
            <a
              className="underline"
              href="https://commons.wikimedia.org/wiki/File:Bangalore_Metro_Purple_Line.jpg"
            >
              Bangalore Metro Purple Line
            </a>{' '}
            by Fly2Blue, CC0.
          </p>
        </footer>
      </section>
    </main>
  );
}
