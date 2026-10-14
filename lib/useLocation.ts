'use client';

import { useCallback, useState, useSyncExternalStore } from 'react';

export interface Coords { lat: number; lon: number; at: number }

export type LocationState =
  | { status: 'idle' }
  | { status: 'locating' }
  | { status: 'ready'; coords: Coords; stale: boolean }
  | {
      status: 'error';
      reason: 'denied' | 'unavailable' | 'timeout' | 'unsupported' | 'insecure';
    };

const CACHE_KEY = 'blr-transit:last-location';

// useSyncExternalStore calls getSnapshot on every render and compares by
// identity, so a fresh JSON.parse each time would loop forever. Re-parse only
// when the raw string actually changed.
let lastRaw: string | null = null;
let lastParsed: Coords | null = null;
const listeners = new Set<() => void>();

function readCache(): Coords | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(CACHE_KEY);
  } catch {
    // Safari Private Browsing can throw on localStorage; treat as a cache miss.
    raw = null;
  }
  if (raw === lastRaw) return lastParsed;
  lastRaw = raw;
  try {
    const parsed = raw ? (JSON.parse(raw) as Coords) : null;
    lastParsed =
      parsed && typeof parsed.lat === 'number' && typeof parsed.lon === 'number' ? parsed : null;
  } catch {
    lastParsed = null;
  }
  return lastParsed;
}

/** Server render has no localStorage, so the cache is always empty there. */
const readServerCache = () => null;

function subscribe(cb: () => void) {
  listeners.add(cb);
  // Other tabs write the same key; same-tab writes notify through writeCache.
  window.addEventListener('storage', cb);
  return () => { listeners.delete(cb); window.removeEventListener('storage', cb); };
}

function writeCache(coords: Coords) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(coords)); } catch { /* private mode */ }
  for (const cb of listeners) cb();
}

/**
 * Geolocation, shaped around how iOS Safari actually behaves:
 *
 *  - `request()` must be called from a user gesture. Requesting on mount gets
 *    swallowed or produces a prompt users reflexively dismiss, so the UI has an
 *    explicit "Use my location" button.
 *  - `navigator.permissions.query()` is deliberately not consulted: on iOS it
 *    disagrees with Safari's real setting, so we call the API and handle the
 *    failure instead of trying to predict it.
 *  - iOS treats the grant as one-shot and re-prompts after a refresh, so the
 *    last fix is read straight out of localStorage and shown immediately
 *    (flagged stale) rather than forcing a prompt on every page load.
 */
export function useLocation() {
  // Read through an external store rather than an effect: this is client-only
  // state that must not exist during SSR, and an effect that setState's on
  // mount would cascade an extra render on every visit.
  const cached = useSyncExternalStore(subscribe, readCache, readServerCache);
  const [live, setLive] = useState<LocationState | null>(null);

  // A cached fix shown before the user has tapped is, by definition, their last
  // known location. Deriving `stale` this way avoids calling Date.now() during
  // render, which is impure and flagged by React's compiler rules.
  const state: LocationState =
    live ?? (cached ? { status: 'ready', coords: cached, stale: true } : { status: 'idle' });

  const request = useCallback(() => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setLive({ status: 'error', reason: 'unsupported' });
      return;
    }

    // On an insecure origin navigator.geolocation still exists but never
    // succeeds — browsers gate it behind a secure context. Without this check
    // the failure is indistinguishable from a denial, which sends people
    // hunting through their browser settings for a permission that was never
    // asked for. Hosting on plain HTTP, or a custom domain before its
    // certificate is issued, lands here.
    if (!window.isSecureContext) {
      setLive({ status: 'error', reason: 'insecure' });
      return;
    }
    setLive({ status: 'locating' });

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords: Coords = {
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          at: Date.now(),
        };
        writeCache(coords);
        setLive({ status: 'ready', coords, stale: false });
      },
      (err) => {
        const reason =
          err.code === err.PERMISSION_DENIED ? 'denied'
          : err.code === err.TIMEOUT ? 'timeout'
          : 'unavailable';
        // Fall back to the cached fix rather than losing the view entirely.
        const fallback = readCache();
        setLive(
          fallback
            ? { status: 'ready', coords: fallback, stale: true }
            : { status: 'error', reason },
        );
      },
      {
        enableHighAccuracy: true,
        // Without an explicit timeout iOS can hang indefinitely with no callback.
        timeout: 15_000,
        // maximumAge MUST be 0 here. With a cache window the browser happily
        // returns a position up to that old, so tapping a button labelled
        // "Update my location" after moving returned the previous fix and
        // nothing on screen changed.
        maximumAge: 0,
      },
    );
  }, []);

  return { state, request };
}
