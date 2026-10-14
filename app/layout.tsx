import type { Metadata, Viewport } from 'next';
import { Barlow, IBM_Plex_Mono } from 'next/font/google';
import { RegisterSW } from '@/components/RegisterSW';
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
  title: 'Namma Commute',
  description:
    'Your nearest Bengaluru metro station: scheduled trains, station parking, fares and what is around it.',
  authors: [{ name: 'Saifulla Attar' }],
  creator: 'Saifulla Attar',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Namma Commute', statusBarStyle: 'black-translucent' },
  icons: { icon: '/icon.svg', apple: '/icon.svg' },
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${barlow.variable} ${plexMono.variable}`}>
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
