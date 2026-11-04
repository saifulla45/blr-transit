'use client';

import { useState } from 'react';
import type { Poi, PoiCategory } from '@/types/transit';
import { IconForCategory, IconForKind, PinIcon } from './icons';
import { Panel } from './Panel';
import { directionsUrl } from '@/lib/maps';

const CATEGORIES: Array<{ id: PoiCategory; label: string }> = [
  { id: 'health', label: 'Health' },
  { id: 'food', label: 'Food' },
  { id: 'shopping', label: 'Shops' },
  { id: 'worship', label: 'Worship' },
  { id: 'money', label: 'Money' },
  { id: 'transport', label: 'Transport' },
  { id: 'essentials', label: 'Essentials' },
];

/** What is within a walk of the station, from OpenStreetMap. */
/** Arrow-in-a-circle, the universal "navigate here" affordance. */
function DirectionsIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
      style={{ color: 'var(--accent)' }} aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 15.5 15.5 8.5M10.5 8.5h5v5" />
    </svg>
  );
}

export function NearbyPanel({ pois, stationName }: { pois: Poi[]; stationName: string }) {
  const present = CATEGORIES.filter((c) => pois.some((p) => p.category === c.id));
  const [active, setActive] = useState<PoiCategory | null>(present[0]?.id ?? null);

  if (present.length === 0) {
    return (
      <Panel id="nearby" icon={<PinIcon size={16} />} title="Nearby">
        <p className="text-[0.8125rem]" style={{ color: 'var(--muted)' }}>
          OpenStreetMap has nothing mapped within a walk of {stationName} yet.
        </p>
      </Panel>
    );
  }

  const shown = pois.filter((p) => p.category === active);

  return (
    <Panel
      id="nearby"
      icon={<PinIcon size={16} />}
      title="Nearby"
      meta={`${pois.length} places · 12 min walk`}
    >
      {/* Wraps rather than scrolls: with seven categories the later ones
          (Worship, Transport, Essentials) sat off the right edge on a phone and
          were effectively invisible. */}
      <div className="flex flex-wrap gap-1 pb-3" role="tablist" aria-label="Nearby categories">
        {present.map((c) => {
          const on = c.id === active;
          return (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setActive(c.id)}
              className="flex shrink-0 items-center gap-1 px-2.5 py-1.5 text-[0.8125rem] font-medium transition-colors"
              style={{
                borderRadius: 'var(--r-md)',
                background: on ? 'var(--accent)' : 'var(--surface)',
                color: on ? 'var(--on-accent)' : 'var(--muted)',
              }}
            >
              <IconForCategory category={c.id} />
              {c.label}
            </button>
          );
        })}
      </div>

      <ul>
        {shown.map((p, i) => (
          <li key={`${p.name}-${i}`} style={{ borderTop: '1px solid var(--rule)' }}>
            {/* The whole row opens directions: a distance that only drops a pin
                tells you where a pharmacy is but not how to walk to it. */}
            <a
              href={directionsUrl(p.lat, p.lon, p.name)}
              target="_blank"
              rel="noreferrer"
              className="tap flex items-center justify-between gap-3 py-2.5"
              aria-label={`Directions to ${p.name}, ${p.kind}, ${p.distance} metres away`}
            >
              <span className="flex min-w-0 items-start gap-2.5">
                {/* The glyph is what makes this list scannable — you look for the
                    cross or the cart rather than reading every label. */}
                <span className="mt-0.5 shrink-0" style={{ color: 'var(--accent)' }}>
                  <IconForKind kind={p.kind} />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[0.9375rem]">{p.name}</span>
                  <span className="text-[0.75rem]" style={{ color: 'var(--muted)' }}>{p.kind}</span>
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-1.5">
                <span
                  className="num text-[0.8125rem]"
                  style={{ color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}
                >
                  {p.distance} m
                </span>
                <DirectionsIcon />
              </span>
            </a>
          </li>
        ))}
      </ul>

      <p className="pt-3 text-[0.75rem]" style={{ color: 'var(--muted)' }}>
        Tap any place for walking directions. Distances are straight-line, so the walk is a
        little longer. Places from OpenStreetMap — coverage is community-contributed and uneven.
      </p>
    </Panel>
  );
}
