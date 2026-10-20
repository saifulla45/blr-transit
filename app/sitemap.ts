import type { MetadataRoute } from 'next';
import { getStationsIndex } from '@/lib/data';
import { absoluteUrl } from '@/lib/site';

/*
 * Required under `output: 'export'`: metadata routes compile to Route
 * Handlers, which Next treats as dynamic by default and refuses to
 * prerender. Without this the build fails outright rather than silently
 * omitting the file.
 */
export const dynamic = 'force-static';

/**
 * Every page on the site, generated from the station index rather than typed
 * out — a hand-maintained list of 83 URLs would be wrong within a month of
 * the next network extension.
 *
 * lastModified comes from the GTFS feed version, not the build clock. Using
 * `new Date()` would tell crawlers all 87 pages changed on every deploy, even
 * a CSS-only one, which trains them to ignore the signal.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const index = await getStationsIndex();
  const lastModified = new Date(index.generatedAt);

  const stations = index.stations.map((station) => ({
    url: absoluteUrl(`/station/${station.id}/`),
    lastModified,
    changeFrequency: 'monthly' as const,
    priority: 0.8,
  }));

  return [
    { url: absoluteUrl('/'), lastModified, changeFrequency: 'weekly', priority: 1 },
    { url: absoluteUrl('/map/'), lastModified, changeFrequency: 'monthly', priority: 0.7 },
    { url: absoluteUrl('/about/'), lastModified, changeFrequency: 'yearly', priority: 0.4 },
    { url: absoluteUrl('/privacy/'), lastModified, changeFrequency: 'yearly', priority: 0.3 },
    ...stations,
  ];
}
