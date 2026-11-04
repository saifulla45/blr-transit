import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono, Instrument_Serif } from 'next/font/google';
import { RegisterSW } from '@/components/RegisterSW';
import { RouteTransition } from '@/components/RouteTransition';
import { OG_IMAGE, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '@/lib/site';
import { getStationsIndex } from '@/lib/data';
import { lineColorCss } from '@/lib/lineColors';
import './globals.css';

/*
  One family in two cuts.

  Geist for everything you read and every heading: a neutral, precise grotesk
  with a tall x-height, which is what matters on a phone held at arm's length
  on a platform. Headings get their character from weight and tight tracking,
  not from a second face.

  Geist Mono for times, fares and distances, which are compared and stacked:
  columns of digits line up and read like a departure board.

  Both self-hosted by next/font, so no CDN request and no layout shift.
*/
const geist = Geist({
  subsets: ['latin'],
  variable: '--font-ui',
  display: 'swap',
});

// Titles only: a fine, high-contrast serif that gives the page its voice.
const display = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  style: ['normal', 'italic'],
  variable: '--font-display',
  display: 'swap',
});

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
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
  appleWebApp: { capable: true, title: SITE_NAME, statusBarStyle: 'default' },
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
    { media: '(prefers-color-scheme: light)', color: '#f2f6f6' },
    { media: '(prefers-color-scheme: dark)', color: '#071415' },
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
    <html lang="en" className={`${geist.variable} ${geistMono.variable} ${display.variable}`}>
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
