'use client';

import { useSyncExternalStore } from 'react';

const KEY = 'blr-transit:recent-stations';
const MAX = 5;

/**
 * Recently viewed stations, most recent first.
 *
 * Complements saved stations: saving is deliberate, this is automatic, and
 * between them a returning rider rarely has to search at all.
 */
let lastRaw: string | null = null;
let lastParsed: string[] = [];
const EMPTY: string[] = [];
const listeners = new Set<() => void>();

function read(): string[] {
  let raw: string | null = null;
  try { raw = localStorage.getItem(KEY); } catch { return EMPTY; }
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

const readServer = () => EMPTY;

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener('storage', cb);
  return () => { listeners.delete(cb); window.removeEventListener('storage', cb); };
}

/** Record a visit. Safe to call on every station page render. */
export function recordVisit(id: string) {
  try {
    const current = read().filter((x) => x !== id);
    const next = [id, ...current].slice(0, MAX);
    localStorage.setItem(KEY, JSON.stringify(next));
    for (const cb of listeners) cb();
  } catch {
    // Private mode: recents are a convenience, not a requirement.
  }
}

export function useRecents(): string[] {
  return useSyncExternalStore(subscribe, read, readServer);
}
