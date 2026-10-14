import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /*
   * Static export: every page here is prerendered already (87 of them), there
   * are no API routes and no middleware, so the whole site is a folder of
   * files. That is what Netlify's drag-and-drop deploy expects.
   */
  output: 'export',

  // The export has no server, so Next's image optimizer cannot run. The hero
  // is the only <Image>, and it is already resized to 1800px at build time.
  images: { unoptimized: true },

  // Emits /map/index.html rather than /map.html, which static hosts serve
  // correctly at /map without extra redirect rules.
  trailingSlash: true,

  // The dev overlay badge otherwise gets captured when importing localhost
  // into design tools, and lands as a stray layer.
  devIndicators: false,
};

export default nextConfig;
