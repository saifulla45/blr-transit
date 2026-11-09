import type { Metadata } from 'next';
import Link from 'next/link';
import { AppBar } from '@/components/AppBar';
import { PageHeader } from '@/components/PageHeader';
import { SiteFooter } from '@/components/SiteFooter';

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
    <>
    <AppBar overlay back={{ href: '/', label: 'Home' }} title="Privacy" />
    <PageHeader eyebrow="Privacy" title="Nothing about you leaves your phone." />
    <main className="mx-auto w-full max-w-[42rem] px-5 pb-6 pt-2 md:px-8">

      <div className="prose-nc mt-8">
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
          The site is served by Cloudflare Pages, which like any web host records standard
          server logs including IP addresses. That is outside this site&rsquo;s control and
          is covered by{' '}
          <a href="https://www.cloudflare.com/privacypolicy/">Cloudflare&rsquo;s privacy policy</a>.
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
    </main>
    <SiteFooter />
    </>
  );
}
