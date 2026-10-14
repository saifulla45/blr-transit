'use client';

import type { Line, Poi, Station } from '@/types/transit';
import { NetworkMap } from './NetworkMap';

/**
 * The station in context: the lines through it, its neighbours, and the places
 * nearby plotted rather than only listed.
 */
export function StationMap({
  station, lines, pois,
}: { station: Station; lines: Line[]; pois?: Poi[] }) {
  return (
    <NetworkMap
      stations={[{ id: station.id, name: station.name, lat: station.lat, lon: station.lon, lines: station.lines, isInterchange: station.isInterchange }]}
      lines={lines}
      pois={pois}
      focus={{ lat: station.lat, lon: station.lon, zoom: 15 }}
      interactive={false}
      className="h-64 overflow-hidden"
    />
  );
}
