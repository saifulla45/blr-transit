import type { Metadata } from 'next';
import Link from 'next/link';
import { Credit } from '@/components/Credit';

export const metadata: Metadata = {
  title: 'Privacy',
  description:
    'Namma Commute collects nothing. Your location is read in the browser and never sent anywhere.',
};

/**
 * Short on purpose.
 *
 * Most privacy policies are long because the site does a lot with your data.
 * This one is a static export with no backend, no analytics and no accounts,
 * so the truthful version fits on a screen — and every claim is verifiable
 * from the page source rather than taken on trust.
 */
export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-[44rem] px-5 py-10 md:px-8">
      <Link
        href="/"
        className="text-[0.8125rem] font-semibold underline underline-offset-2"
        style={{ color: 'var(--accent)' }}
      >
        ← Namma Commute
      </Link>

      <h1 className="mt-5 text-[1.75rem] font-bold leading-tight">Privacy</h1>

      <div
        className="mt-5 flex flex-col gap-3.5 text-[0.9375rem] leading-relaxed [&_a]:underline [&_a]:underline-offset-2 [&_h2]:mt-4 [&_h2]:text-[1.0625rem] [&_h2]:font-semibold [&_li]:ml-4 [&_li]:list-disc [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1.5"
        style={{ color: 'var(--ink)' }}
      >
        <p>
          <strong>No accounts, no analytics, no advertising, no cookies.</strong> There is no
          server to send anything to — this site is a folder of static files on a CDN.
        </p>

        <h2>Your location</h2>
        <p>
          When you tap <em>Find my nearest station</em>, the browser asks your permission and
          gives the page your coordinates. Those coordinates are used in your browser to
          work out which station is closest and what is nearby. <strong>They are never
          transmitted anywhere.</strong> There is no endpoint they could be sent to.
        </p>
        <p>
          Your most recent position is kept in your browser&rsquo;s local storage so the page
          can show results immediately on your next visit instead of asking again. Clearing
          your browser data removes it. You can also simply never grant permission — search
          works without it.
        </p>

        <h2>What is stored on your device</h2>
        <ul>
          <li>Last known coordinates, so results appear without re-prompting</li>
          <li>Stations you saved or recently viewed</li>
          <li>A cache of timetable files, so the site works on a bad connection</li>
        </ul>
        <p>All of it is local. None of it is readable by anyone but you.</p>

        <h2>Links to other services</h2>
        <p>
          Booking a ride or opening directions hands you over to Google Maps, Uber, Ola,
          Rapido or Namma Yatri, and those links include the station&rsquo;s coordinates — the
          destination, not you. Once you arrive, that company&rsquo;s own privacy policy
          applies. Links to other cities&rsquo; metro operators work the same way.
        </p>

        <h2>Hosting</h2>
        <p>
          The site is served by Netlify, which like any web host records standard server
          logs including IP addresses. That is outside this site&rsquo;s control and is
          covered by{' '}
          <a href="https://www.netlify.com/privacy/">Netlify&rsquo;s privacy policy</a>.
        </p>

        <h2>Map tiles</h2>
        <p>
          The map loads tiles from <a href="https://openfreemap.org/">OpenFreeMap</a>, which
          means your browser requests map images from them while a map is open. No account
          or key is involved. Every other page works without contacting them at all.
        </p>

        <h2>Changes</h2>
        <p>
          If this ever changes — if analytics or ads are added — this page changes first and
          says so plainly. See <Link href="/about/">about</Link> for what the site does and
          where its data comes from.
        </p>
      </div>

      <p className="mt-8 text-[0.75rem]" style={{ color: 'var(--muted)' }}>
        <Credit />
      </p>
    </main>
  );
}
