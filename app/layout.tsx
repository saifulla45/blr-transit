import type { Metadata, Viewport } from 'next';
import { Barlow, IBM_Plex_Mono } from 'next/font/google';
import { RegisterSW } from '@/components/RegisterSW';
import { OG_IMAGE, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '@/lib/site';
import { getStationsIndex } from '@/lib/data';
import { lineColorCss } from '@/lib/lineColors';
import './globals.css';

// Barlow is a grotesk drawn from public-signage lettering — the vernacular this
// app actually lives in. next/font self-hosts it, so no CDN request at runtime.
const barlow = Barlow({
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
    <html lang="en" className={`${barlow.variable} ${plexMono.variable}`}>
      <head>
        {/*
          Blocking and tiny, on purpose. It marks that scripting is available
          so the scroll-reveal CSS can hide things it is able to bring back.
          Without it a reader with JS disabled would get a blank page.
        */}
        <script
          dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('js')" }}
        />
        {/* Generated from route_color; ids are sanitised and colours are
            re-emitted as #rrggbb, so no feed text reaches the stylesheet. */}
        <style dangerouslySetInnerHTML={{ __html: lineColorCss(lines) }} />
      </head>
      <body
        className="min-h-[100dvh]"
        style={{ fontFamily: 'var(--font-ui), ui-sans-serif, system-ui, sans-serif' }}
      >
        {children}
        <RegisterSW />
      </body>
    </html>
  );
}
