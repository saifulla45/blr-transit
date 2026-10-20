/**
 * Where this site lives.
 *
 * Absolute URLs are unavoidable for three things — sitemap entries, robots'
 * sitemap pointer, and Open Graph images, which crawlers and WhatsApp fetch
 * out of band with no page context to resolve a relative path against. Every
 * one of them is baked at build, so this has to be known at build too.
 *
 * Set NEXT_PUBLIC_SITE_URL in Netlify when a custom domain is attached. The
 * default is the Netlify subdomain rather than a placeholder, so a forgotten
 * env var ships a working sitemap instead of a sitemap full of example.com.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://namma-commute.netlify.app'
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
