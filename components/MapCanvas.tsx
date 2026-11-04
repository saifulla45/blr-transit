'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  GPUInitializationError, Map as MapLibreMap, Marker, NavigationControl, Popup, setWorkerUrl,
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Line, Station } from '@/types/transit';

// OpenFreeMap: no API key, no registration, no usage caps. MapLibre adds the
// required OSM attribution automatically.
const STYLE_LIGHT = 'https://tiles.openfreemap.org/styles/positron';
const STYLE_DARK = 'https://tiles.openfreemap.org/styles/dark';

/**
 * The map has to follow the page theme, or a dark page renders a glaring white
 * rectangle. Reads the explicit data-theme stamp first, then the OS preference,
 * matching the token cascade in globals.css.
 */
function prefersDark(): boolean {
  const stamped = document.documentElement.getAttribute('data-theme');
  if (stamped === 'dark') return true;
  if (stamped === 'light') return false;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
}

// MapLibre v6 loads its worker from a separate file, and Next emits neither it
// nor its maplibre-gl-shared.mjs sibling. Without this the worker 404s and the
// map draws a blank grey canvas. scripts/copy-maplibre-worker.mjs puts the
// files here as a prebuild/predev step.
setWorkerUrl('/maplibre/maplibre-gl-worker.mjs');

/** MapLibre v6 requires WebGL2 and throws without it. Cheaper to ask first. */
function hasWebGL2(): boolean {
  try {
    return !!document.createElement('canvas').getContext('webgl2');
  } catch {
    return false;
  }
}

export default function MapCanvas({ station, lines }: { station: Station; lines: Line[] }) {
  // This component is only ever rendered client-side (dynamic with ssr:false),
  // so a lazy initialiser can probe WebGL2 without an effect.
  const [supported] = useState(hasWebGL2);
  const [failed, setFailed] = useState(false);
  const [dark, setDark] = useState(prefersDark);

  // Follow the OS flipping theme while the page is open.
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const sync = () => setDark(prefersDark());
    mq.addEventListener('change', sync);
    // The explicit data-theme stamp can change too (theme toggle, or a parent app).
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => { mq.removeEventListener('change', sync); observer.disconnect(); };
  }, []);

  // A callback ref rather than an effect: it runs once per node, returns its own
  // cleanup, and keeps the failure path out of an effect's render cascade.
  const mount = useCallback((node: HTMLDivElement | null) => {
    if (!node || !supported) return;

    let map: MapLibreMap;
    try {
      map = new MapLibreMap({
        container: node,
        style: dark ? STYLE_DARK : STYLE_LIGHT,
        center: [station.lon, station.lat],
        zoom: 14,
        attributionControl: { compact: true },
      });

    // MapLibre opens the compact attribution expanded until the first drag,
    // which covered a fifth of a phone-sized map; start it folded to the (i).
    map.once('load', () => {
      const attrib = node.querySelector('.maplibregl-ctrl-attrib');
      attrib?.classList.remove('maplibregl-compact-show');
      attrib?.removeAttribute('open');
    });
    } catch (err) {
      // Lockdown Mode and some managed devices fail here despite the probe.
      if (err instanceof GPUInitializationError) { setFailed(true); return; }
      throw err;
    }

    const colour = lines.find((l) => l.id === station.lines[0])?.color ?? '#8c2877';
    new Marker({ color: colour })
      .setLngLat([station.lon, station.lat])
      .setPopup(new Popup().setText(station.name))
      .addTo(map);

    map.addControl(new NavigationControl({ showCompass: false }), 'top-right');
    // Context loss after creation arrives through the error event, not the throw.
    map.on('error', (e: { error?: unknown }) => {
      if (e.error instanceof GPUInitializationError) setFailed(true);
    });

    return () => map.remove();
  }, [station, lines, supported, dark]);

  if (!supported || failed) {
    return (
      <p className="p-4 text-sm" style={{ color: 'var(--muted)' }}>
        The map needs WebGL2, which this browser does not provide.{' '}
        <a
          className="underline"
          href={`https://www.openstreetmap.org/?mlat=${station.lat}&mlon=${station.lon}#map=16/${station.lat}/${station.lon}`}
        >
          Open in OpenStreetMap
        </a>
        .
      </p>
    );
  }

  return <div ref={mount} className="h-full w-full" />;
}
