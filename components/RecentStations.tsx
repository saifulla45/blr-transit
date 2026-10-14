'use client';

import type { Line, Station } from '@/types/transit';
import { useRecents } from '@/lib/useRecents';
import { useSaved } from '@/lib/useSaved';
import { StationRow } from './StationRow';

/** Recently viewed stations, excluding ones already pinned. */
export function RecentStations({ stations, lines }: { stations: Station[]; lines: Line[] }) {
  const recents = useRecents();
  const { saved } = useSaved();
  const byId = new Map(stations.map((s) => [s.id, s]));

  // No point listing a station twice when it is already pinned above.
  const show = recents
    .filter((id) => !saved.includes(id))
    .map((id) => byId.get(id))
    .filter(Boolean) as Station[];

  if (show.length === 0) return null;

  return (
    <section className="stop-in min-w-0 md:col-span-2">
      <h2 className="eyebrow pb-1">Recently viewed</h2>
      <div className="min-w-0 md:grid md:grid-cols-2 md:gap-x-10">
        {show.map((s) => <StationRow key={s.id} station={s} lines={lines} />)}
      </div>
    </section>
  );
}
