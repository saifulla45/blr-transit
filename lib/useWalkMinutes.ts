'use client';

import { useSyncExternalStore } from 'react';
import { haversineKm, walkingMinutes } from './geo';
import { WALK_TOO_FAR_KM } from './lastmile';
import { useLocation } from './useLocation';

// Inside the station already, or near enough that "leave now" is noise.
const AT_STATION_KM = 0.08;
// A fix older than this may be from somewhere else entirely — home last
// week — and a confident "leave in 3 min" from there would be wrong.
const FRESH_FOR_MS = 15 * 60_000;

// A minute-resolution clock: stable within the minute, so it can be read
// during render without tripping React's purity rules or re-rendering often.
function subscribeMinute(cb: () => void) {
  const id = setInterval(cb, 30_000);
  return () => clearInterval(id);
}
const minuteNow = () => Math.floor(Date.now() / 60_000);
const serverMinute = () => 0;

/**
 * Minutes on foot from a recent fix to this station, or null when there is
 * no fix, it is stale, or it is beyond walking range — past 3 km nobody
 * walks, so a walk-based "leave in" would be fiction.
 */
export function useWalkMinutes(lat: number, lon: number): number | null {
  const { state } = useLocation();
  const minute = useSyncExternalStore(subscribeMinute, minuteNow, serverMinute);
  if (state.status !== 'ready') return null;
  if (minute * 60_000 - state.coords.at > FRESH_FOR_MS) return null;
  const km = haversineKm(state.coords.lat, state.coords.lon, lat, lon);
  if (km > WALK_TOO_FAR_KM || km < AT_STATION_KM) return null;
  return walkingMinutes(km);
}
