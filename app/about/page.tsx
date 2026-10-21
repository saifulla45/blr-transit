import type { Metadata } from 'next';
import Link from 'next/link';
import { Credit } from '@/components/Credit';
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
    <main className="mx-auto w-full max-w-[44rem] px-5 py-10 md:px-8">
      <Link
        href="/"
        className="text-[0.8125rem] font-semibold underline underline-offset-2"
        style={{ color: 'var(--accent)' }}
      >
        ← Namma Commute
      </Link>

      <h1 className="mt-5 text-[1.75rem] font-bold leading-tight">About</h1>

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

      <p className="mt-8 text-[0.75rem]" style={{ color: 'var(--muted)' }}>
        <Credit />
      </p>
    </main>
  );
}

/**
 * Local prose styling. The app has no global typographic defaults because
 * every other page is a dense UI of cards and rows, not running text — so
 * the two long-form pages carry their own rhythm rather than the whole app
 * carrying rules only they use.
 */
function Prose({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="mt-5 flex flex-col gap-3.5 text-[0.9375rem] leading-relaxed [&_a]:underline [&_a]:underline-offset-2 [&_h2]:mt-4 [&_h2]:text-[1.0625rem] [&_h2]:font-semibold [&_li]:ml-4 [&_li]:list-disc [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1.5"
      style={{ color: 'var(--ink)' }}
    >
      {children}
    </div>
  );
}

function Mono({ children }: { children: React.ReactNode }) {
  return (
    <span className="num" style={{ fontFamily: 'var(--font-mono), monospace' }}>{children}</span>
  );
}
