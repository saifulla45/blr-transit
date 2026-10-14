'use client';

import { useCallback, useSyncExternalStore } from 'react';

const KEY = 'blr-transit:saved-stations';

/**
 * Stations the rider has pinned — typically home and work.
 *
 * A daily commuter uses the same two stations forever and was otherwise
 * re-locating or re-searching on every single visit.
 *
 * Read through an external store rather than an effect, so the value is
 * available on first client render without a setState cascade. getSnapshot
 * must return a stable reference or React loops, hence the parse cache.
 */
let lastRaw: string | null = null;
let lastParsed: string[] = [];
const EMPTY: string[] = [];
const listeners = new Set<() => void>();

function read(): string[] {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return EMPTY;   // Safari private mode
  }
  if (raw === lastRaw) return lastParsed;
  lastRaw = raw;
  try {
    const parsed = raw ? JSON.parse(raw) : [];
    lastParsed = Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : EMPTY;
  } catch {
    lastParsed = EMPTY;
  }
  return lastParsed;
}

/** The server has no localStorage, so nothing is saved there. */
const readServer = () => EMPTY;

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener('storage', cb);
  return () => { listeners.delete(cb); window.removeEventListener('storage', cb); };
}

function write(ids: string[]) {
  try { localStorage.setItem(KEY, JSON.stringify(ids)); } catch { /* private mode */ }
  for (const cb of listeners) cb();
}

export function useSaved() {
  const saved = useSyncExternalStore(subscribe, read, readServer);

  const toggle = useCallback((id: string) => {
    const current = read();
    write(current.includes(id) ? current.filter((x) => x !== id) : [...current, id]);
  }, []);

  const isSaved = useCallback((id: string) => saved.includes(id), [saved]);

  return { saved, toggle, isSaved };
}
