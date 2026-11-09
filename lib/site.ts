/**
 * Where this site lives.
 *
 * Absolute URLs are unavoidable for three things — sitemap entries, robots'
 * sitemap pointer, and Open Graph images, which crawlers and WhatsApp fetch
 * out of band with no page context to resolve a relative path against. Every
 * one of them is baked at build, so this has to be known at build too.
 *
 * The default is wherever the site actually lives, never a placeholder, so a
 * forgotten env var still ships a working sitemap rather than one full of
 * example.com. It pointed at the old Netlify subdomain after the move to
 * Cloudflare, which meant the live site handed Google a sitemap, a robots
 * pointer and an og:url all naming a different host — telling crawlers the
 * real copy was somewhere else, so this one could never rank.
 *
 * Override it at BUILD time when a custom domain is attached, because every
 * one of these URLs is baked into the output:
 *
 *   NEXT_PUBLIC_SITE_URL=https://nammacommute.com npm run build
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://namma-commute.pages.dev'
).replace(/\/$/, '');

export const SITE_NAME = 'Namma Commute';

export const SITE_DESCRIPTION =
  'Your nearest Bengaluru metro station: scheduled trains, station parking, '
  + 'fares, buses and what is around it.';

/** Absolute URL for a path. Leading slash optional. */
export function absoluteUrl(path = '/'): string {
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

/**
 * The share card, defined once.
 *
 * Next replaces the `openGraph` object wholesale on a nested page rather than
 * merging it, so any page that sets its own og:title silently loses the
 * inherited image. Every page that overrides openGraph must spell the image
 * out again — hence this constant rather than a copied literal.
 */
export const OG_IMAGE = {
  url: '/og.png',
  width: 1200,
  height: 630,
  alt: `${SITE_NAME} — Bengaluru metro`,
} as const;
