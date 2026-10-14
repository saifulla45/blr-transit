/**
 * Copies MapLibre's worker into public/maplibre/.
 *
 * MapLibre v6 ships the worker as a separate file (v5 inlined it), and neither
 * Turbopack nor Next's webpack mode emits the worker's sibling
 * maplibre-gl-shared.mjs, so the worker 404s on its first import and the map
 * renders as a blank grey canvas. MapLibre's docs call Next.js out as an
 * exception requiring exactly this copy step. Paired with setWorkerUrl() in
 * components/MapCanvas.tsx.
 */
import { copyFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const dist = path.join(
  path.dirname(createRequire(import.meta.url).resolve('maplibre-gl/package.json')),
  'dist',
);
const dest = path.join(process.cwd(), 'public', 'maplibre');

mkdirSync(dest, { recursive: true });
for (const file of ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs']) {
  copyFileSync(path.join(dist, file), path.join(dest, file));
}
console.log(`Copied MapLibre worker files to ${dest}`);
