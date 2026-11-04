'use client';

import { useEffect, useState } from 'react';
import type { Station } from '@/types/transit';
import { SERVICE_RADIUS_KM, haversineKm } from '@/lib/geo';
import { nowInBengaluru } from '@/lib/time';
import { useLocation } from '@/lib/useLocation';
import { LastMile } from './LastMile';

/**
 * The ride to THIS station from wherever you are, on its own page.
 *
 * Someone who searched for Yeshwantpur from 17 km away was shown only a
 * walking time; the useful answer is what an auto or cab costs and a link
 * that opens the app with both ends filled in. Uses the last known fix, so
 * it appears without asking for permission again.
 */
export function GettingHere({ station }: { station: Station }) {
  const { state } = useLocation();
  const [now, setNow] = useState<ReturnType<typeof nowInBengaluru> | null>(null);
  useEffect(() => {
    const tick = () => setNow(nowInBengaluru());
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  if (state.status !== 'ready' || !now) return null;
  const km = haversineKm(state.coords.lat, state.coords.lon, station.lat, station.lon);
  // From another city the distance is real but the ride card is meaningless.
  if (km > SERVICE_RADIUS_KM) return null;

  return (
    <LastMile
      station={station}
      distanceKm={km}
      minutesSinceMidnight={now.minutes}
      from={state.coords}
      eyebrow="Getting here"
      collapsible
      title={`Ride to ${station.name}`}
    />
  );
}
