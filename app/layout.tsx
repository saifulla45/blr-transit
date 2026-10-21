import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, IBM_Plex_Mono, Plus_Jakarta_Sans } from 'next/font/google';
import { RegisterSW } from '@/components/RegisterSW';
import { RouteTransition } from '@/components/RouteTransition';
import { OG_IMAGE, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '@/lib/site';
import { getStationsIndex } from '@/lib/data';
import { lineColorCss } from '@/lib/lineColors';
import './globals.css';

/*
  Three faces, each with a job.

  Bricolage Grotesque for display. It carries real personality — slightly
  condensed, with an unusual tension in the curves — which is what stops a
  transit site reading like a spreadsheet, and its optical sizing axis keeps
  the headline tight at 68px without getting airy at 24px.

  Plus Jakarta Sans for everything you actually read. Open apertures and a
  tall x-height, which is what matters on a phone held at arm's length on a
  platform in daylight. Replaces Barlow, which was chosen for its signage
  heritage but is plain at body size.

  Both self-hosted by next/font, so no CDN request and no layout shift.
*/
const display = Bricolage_Grotesque({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  variable: '--font-display',
  display: 'swap',
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-ui',
  display: 'swap',
});

// Times, fares, distances and capacities are all columns of digits; a
// monospace face makes them line up and reads like a departure board.
const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  // metadataBase resolves the relative URLs below into absolute ones. Without
  // it Next emits a relative og:image, and WhatsApp, Slack and Twitter all
  // fetch the card out of band with no page to resolve it against — so the
  // preview silently falls back to a bare link.
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_NAME,
    // Station pages set their own name and inherit the suffix.
    template: `%s — ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  authors: [{ name: 'Saifulla Attar', url: 'https://www.linkedin.com/in/mdsaifullaattar' }],
  creator: 'Saifulla Attar',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: SITE_NAME, statusBarStyle: 'black-translucent' },
  icons: { icon: '/icon.svg', apple: '/icon.svg' },
  keywords: [
    'Namma Metro', 'Bengaluru metro', 'Bangalore metro timings', 'metro fare',
    'BMRCL', 'BMTC bus', 'metro parking', 'nearest metro station',
  ],
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    locale: 'en_IN',
    url: '/',
    images: [OG_IMAGE],
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    images: ['/og.png'],
  },
  // Nothing here is private, and the 83 station pages are only reachable via
  // in-page links, so crawling them is actively wanted.
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Lets env(safe-area-inset-*) resolve on notched iPhones.
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fbfafc' },
    { media: '(prefers-color-scheme: dark)', color: '#141118' },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  /*
    Line colours come from the feed, not from globals.css.

    Emitted here so all 14 lineVar() call sites resolve without threading the
    lines array through every component, and so the day BMRCL's Blue and Pink
    lines appear in the GTFS they get their own colours with no code change.
    Previously lineVar() fell through to yellow for any unrecognised line,
    which would have painted both new lines yellow with no error.
  */
  const { lines } = await getStationsIndex();

  return (
    <html lang="en" className={`${display.variable} ${jakarta.variable} ${plexMono.variable}`}>
      <head>
        {/* Generated from route_color; ids are sanitised and colours are
            re-emitted as #rrggbb, so no feed text reaches the stylesheet. */}
        <style dangerouslySetInnerHTML={{ __html: lineColorCss(lines) }} />
      </head>
      <body
        className="min-h-[100dvh]"
        style={{ fontFamily: 'var(--font-ui), ui-sans-serif, system-ui, sans-serif' }}
      >
        <RouteTransition>{children}</RouteTransition>
        <RegisterSW />
      </body>
    </html>
  );
}
