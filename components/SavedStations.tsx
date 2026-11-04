'use client';

import type { Line, Station } from '@/types/transit';
import { useSaved } from '@/lib/useSaved';
import { StationRow } from './StationRow';

/** Pinned stations, shown first on the home page. */
export function SavedStations({ stations, lines }: { stations: Station[]; lines: Line[] }) {
  const { saved } = useSaved();
  if (saved.length === 0) return null;

  const byId = new Map(stations.map((s) => [s.id, s]));
  const pinned = saved.map((id) => byId.get(id)).filter(Boolean) as Station[];
  if (pinned.length === 0) return null;

  return (
    // Fades in because it is client-only data and would otherwise snap in
    // after hydration, which reads as a glitch.
    <section className="stop-in min-w-0 md:col-span-2">
      <p className="eyebrow">Saved</p>
      <h2 className="section-title mt-1 pb-3">Your stations</h2>
      <div className="grid min-w-0 gap-2 md:grid-cols-2">
        {pinned.map((s) => <StationRow key={s.id} station={s} lines={lines} />)}
      </div>
    </section>
  );
}
