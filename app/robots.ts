import type { MetadataRoute } from 'next';
import { absoluteUrl } from '@/lib/site';

/*
 * Required under `output: 'export'`: metadata routes compile to Route
 * Handlers, which Next treats as dynamic by default and refuses to
 * prerender. Without this the build fails outright rather than silently
 * omitting the file.
 */
export const dynamic = 'force-static';

/**
 * Emitted as a static /robots.txt at build, so it survives `output: 'export'`.
 *
 * Everything is allowed: the whole site is public transit information and
 * there is nothing to hide. The one job this file actually does here is
 * pointing crawlers at the sitemap, since 83 station pages are reachable only
 * by in-page links and would otherwise be found slowly or not at all.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/' }],
    sitemap: absoluteUrl('/sitemap.xml'),
  };
}
