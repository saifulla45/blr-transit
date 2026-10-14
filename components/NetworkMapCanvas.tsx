'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  GPUInitializationError, Map as MapLibreMap, NavigationControl, Popup, setWorkerUrl,
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Line, Poi, StationLite } from '@/types/transit';

const STYLE_LIGHT = 'https://tiles.openfreemap.org/styles/positron';
const STYLE_DARK = 'https://tiles.openfreemap.org/styles/dark';

setWorkerUrl('/maplibre/maplibre-gl-worker.mjs');

function prefersDark(): boolean {
  const stamped = document.documentElement.getAttribute('data-theme');
  if (stamped === 'dark') return true;
  if (stamped === 'light') return false;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
}

function hasWebGL2(): boolean {
  try { return !!document.createElement('canvas').getContext('webgl2'); } catch { return false; }
}

export interface NetworkMapProps {
  stations: StationLite[];
  lines: Line[];
  /** Station ids to draw as a highlighted journey, in travel order. */
  journey?: string[];
  /** Places to plot alongside the stations. */
  pois?: Poi[];
  /** Centre and zoom on one station rather than the whole network. */
  focus?: { lat: number; lon: number; zoom: number };
  /** Clicking a station navigates to it. */
  interactive?: boolean;
}

/**
 * The network itself, drawn from the line geometry. A metro app without a map
 * of the metro is missing the thing people picture when they plan a trip.
 */
export default function NetworkMapCanvas({
  stations, lines, journey, pois, focus, interactive = true,
}: NetworkMapProps) {
  const router = useRouter();
  const [supported] = useState(hasWebGL2);
  const [failed, setFailed] = useState(false);
  const [dark, setDark] = useState(prefersDark);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const sync = () => setDark(prefersDark());
    mq.addEventListener('change', sync);
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => { mq.removeEventListener('change', sync); observer.disconnect(); };
  }, []);

  const mount = useCallback((node: HTMLDivElement | null) => {
    if (!node || !supported) return;

    let map: MapLibreMap;
    try {
      map = new MapLibreMap({
        container: node,
        style: dark ? STYLE_DARK : STYLE_LIGHT,
        center: focus ? [focus.lon, focus.lat] : [77.59, 12.96],
        zoom: focus?.zoom ?? 10.4,
        attributionControl: { compact: true },
      });
    } catch (err) {
      if (err instanceof GPUInitializationError) { setFailed(true); return; }
      throw err;
    }

    map.addControl(new NavigationControl({ showCompass: false }), 'top-right');

    // A map inside a flex or grid container is often created before that
    // container has resolved its height. MapLibre then sizes itself to zero and
    // never recovers, which renders as an empty box with no error at all.
    const ro = new ResizeObserver(() => map.resize());
    ro.observe(node);

    map.on('load', async () => {
      // Line geometry, drawn in each line's own colour.
      try {
        const res = await fetch('/data/lines.geojson');
        const geo = await res.json();
        map.addSource('lines', { type: 'geojson', data: geo });
        map.addLayer({
          id: 'lines',
          type: 'line',
          source: 'lines',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: {
            'line-color': ['get', 'color'],
            'line-width': ['interpolate', ['linear'], ['zoom'], 9, 2.5, 14, 5],
            'line-opacity': journey ? 0.3 : 0.85,
          },
        });
      } catch {
        // The stations alone still make a usable map.
      }

      const onJourney = new Set(journey ?? []);

      // The journey, drawn over the network.
      if (journey && journey.length > 1) {
        const byId = new Map(stations.map((s) => [s.id, s]));
        const coords = journey
          .map((id) => byId.get(id))
          .filter(Boolean)
          .map((s) => [s!.lon, s!.lat]);
        map.addSource('journey', {
          type: 'geojson',
          data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } },
        });
        map.addLayer({
          id: 'journey',
          type: 'line',
          source: 'journey',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': '#c264d8', 'line-width': 5 },
        });
      }

      // Stations as circles; the ones on the journey get emphasis.
      map.addSource('stations', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: stations.map((s) => ({
            type: 'Feature' as const,
            properties: {
              id: s.id,
              name: s.name,
              color: lines.find((l) => l.id === s.lines[0])?.color ?? '#8c2877',
              hit: onJourney.has(s.id) ? 1 : 0,
              interchange: s.isInterchange ? 1 : 0,
            },
            geometry: { type: 'Point' as const, coordinates: [s.lon, s.lat] },
          })),
        },
      });
      map.addLayer({
        id: 'stations',
        type: 'circle',
        source: 'stations',
        paint: {
          'circle-radius': [
            'interpolate', ['linear'], ['zoom'],
            9, ['case', ['==', ['get', 'interchange'], 1], 4, 2.6],
            14, ['case', ['==', ['get', 'interchange'], 1], 8, 5.5],
          ],
          'circle-color': dark ? '#141118' : '#ffffff',
          'circle-stroke-color': ['get', 'color'],
          'circle-stroke-width': ['case', ['==', ['get', 'hit'], 1], 3.5, 2],
          'circle-opacity': journey ? ['case', ['==', ['get', 'hit'], 1], 1, 0.55] : 1,
        },
      });

      if (pois?.length) {
        map.addSource('pois', {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: pois.map((p) => ({
              type: 'Feature' as const,
              properties: { name: p.name, kind: p.kind },
              geometry: { type: 'Point' as const, coordinates: [p.lon, p.lat] },
            })),
          },
        });
        map.addLayer({
          id: 'pois',
          type: 'circle',
          source: 'pois',
          paint: {
            'circle-radius': 3.5,
            'circle-color': '#8a5a08',
            'circle-opacity': 0.75,
          },
        });
        map.on('click', 'pois', (e) => {
          const f = e.features?.[0];
          if (!f) return;
          new Popup({ closeButton: false })
            .setLngLat(e.lngLat)
            .setText(`${f.properties?.name} · ${f.properties?.kind}`)
            .addTo(map);
        });
      }

      if (interactive) {
        map.on('click', 'stations', (e) => {
          const id = e.features?.[0]?.properties?.id;
          if (id) router.push(`/station/${id}`);
        });
        map.on('mouseenter', 'stations', () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', 'stations', () => { map.getCanvas().style.cursor = ''; });
      }
    });

    map.on('error', (e: { error?: unknown }) => {
      if (e.error instanceof GPUInitializationError) setFailed(true);
    });

    return () => { ro.disconnect(); map.remove(); };
  }, [stations, lines, journey, pois, focus, interactive, dark, supported, router]);

  if (!supported || failed) {
    return (
      <p className="p-4 text-sm" style={{ color: 'var(--muted)' }}>
        The map needs WebGL2, which this browser does not provide.
      </p>
    );
  }

  return <div ref={mount} className="h-full w-full" />;
}
