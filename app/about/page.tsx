import type { Metadata } from 'next';
import Link from 'next/link';
import { AppBar } from '@/components/AppBar';
import { PageHeader } from '@/components/PageHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { getStationsIndex } from '@/lib/data';
import { SITE_DESCRIPTION } from '@/lib/site';

export const metadata: Metadata = {
  title: 'About',
  description: SITE_DESCRIPTION,
};

/**
 * The page that answers "can I trust this".
 *
 * A civic tool with no company behind it has to earn that in writing: where
 * the numbers come from, how old they are, and — most importantly — what it
 * cannot do. The limitations section is the point of this page, not a
 * disclaimer bolted on the end.
 */
export default async function AboutPage() {
  const { stations, feedVersion, sourceCommit, generatedAt } = await getStationsIndex();
  const built = new Date(generatedAt).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata',
  });

  return (
    <>
    <AppBar overlay back={{ href: '/', label: 'Home' }} title="About" />
    <PageHeader eyebrow="About" title="A metro guide you can trust." />
    <main className="mx-auto w-full max-w-[42rem] px-5 pb-6 pt-2 md:px-8">

      <Prose>
        <p>
          Namma Commute answers one question quickly: <em>I am standing here — what is my
          nearest metro station, when is the next train, what will it cost, and what is
          around it?</em> Today that means juggling the Namma Metro app, a BMTC app, Google
          Maps and a BMRCL parking PDF.
        </p>

        <h2>What it knows</h2>
        <ul>
          <li>All {stations.length} Namma Metro stations, with scheduled departures by direction</li>
          <li>Fares, including peak and off-peak, and whether a pass is cheaper</li>
          <li>Station parking capacity and the city-wide rate card</li>
          <li>Bus routes serving each station</li>
          <li>Nearby hospitals, pharmacies, food, groceries and places of worship</li>
          <li>Auto and ride fares when the station is too far to walk</li>
        </ul>

        <h2>What it cannot do</h2>
        <p>
          <strong>Nothing here is realtime.</strong> BMRCL publishes no live feed, so there is
          no way for this or any other app — including BMRCL&rsquo;s own — to tell you where a
          train physically is. Every time shown is a scheduled time from the published
          timetable, combined with your device&rsquo;s clock. If a train is delayed, this will
          not know.
        </p>
        <p>
          Bus timings come from a community feed whose schedules are known to be
          approximate. Treat them as a guide to <em>which</em> bus, not <em>when</em>.
        </p>
        <p>
          Distances are straight-line, not walking routes, so a river or a flyover can make
          the real walk longer. Ride fares other than the regulated auto meter are estimates
          against demand pricing — the app you book with will quote the real figure.
        </p>
        <p>
          Nearby places come from OpenStreetMap, which is excellent for hospitals and patchy
          for small shops. A missing shop means nobody has mapped it yet.
        </p>

        <h2>Where the data comes from</h2>
        <ul>
          <li>
            Timetables and fares —{' '}
            <a href="https://github.com/Vonter/bmrcl-gtfs">Vonter/bmrcl-gtfs</a>, transcribed
            from BMRCL&rsquo;s published timetables (ODbL 1.0)
          </li>
          <li>
            Buses — <a href="https://github.com/Vonter/bmtc-gtfs">Vonter/bmtc-gtfs</a> (ODbL 1.0)
          </li>
          <li>
            Parking — <a href="https://english.bmrc.co.in/parking/">BMRCL</a>
          </li>
          <li>
            Places, entrances and the map — © <a href="https://www.openstreetmap.org/copyright">
            OpenStreetMap</a> contributors (ODbL 1.0)
          </li>
          <li>Auto tariff — Bangalore Urban District RTA rate card</li>
        </ul>
        <p>
          Feed version <Mono>{feedVersion}</Mono>, source commit <Mono>{sourceCommit.slice(0, 7)}</Mono>,
          data built {built}. The pipeline re-runs weekly and fails loudly rather than
          publishing data it cannot verify.
        </p>

        <h2>Cost and ads</h2>
        <p>
          Free, with no advertising, no accounts and no tracking. It is a static site, so it
          costs almost nothing to run. See the{' '}
          <Link href="/privacy/">privacy page</Link> for what that means for your data —
          briefly, your location never leaves your device.
        </p>

        <h2 id="corrections">Corrections</h2>
        <p>
          Wrong timing, missing station entrance, outdated parking rate? The underlying data
          is open, and fixing it upstream fixes it for everyone — place and entrance
          corrections go to <a href="https://www.openstreetmap.org/">OpenStreetMap</a>,
          timetable issues to the <a href="https://github.com/Vonter/bmrcl-gtfs">feed</a>.
        </p>
      </Prose>
    </main>
    <SiteFooter />
    </>
  );
}

/** Long-form rhythm, shared with the privacy page through .prose-nc. */
function Prose({ children }: { children: React.ReactNode }) {
  return <div className="prose-nc mt-8">{children}</div>;
}

function Mono({ children }: { children: React.ReactNode }) {
  return (
    <span className="num" style={{ fontVariantNumeric: 'tabular-nums' }}>{children}</span>
  );
}
