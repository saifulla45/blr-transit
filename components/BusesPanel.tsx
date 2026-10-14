'use client';

import { useState } from 'react';
import type { BusRoute } from '@/types/transit';
import { formatMinutes } from '@/lib/time';
import { BusIcon } from './icons';
import { Panel } from './Panel';

const INITIAL = 5;

/**
 * BMTC routes catchable near this station — the first/last-mile link the metro
 * alone does not answer.
 *
 * Deliberately shows frequency and service span rather than a "next bus" time:
 * the upstream feed is scraped from the Namma BMTC app and its per-trip times
 * are known to be unreliable. Trip counts across a day are a fair frequency
 * signal even when individual departures are not.
 */
export function BusesPanel({ buses, stationName }: { buses: BusRoute[]; stationName: string }) {
  const [expanded, setExpanded] = useState(false);

  if (buses.length === 0) {
    return (
      <Panel id="buses" icon={<BusIcon size={16} />} title="Buses">
        <p className="text-[0.8125rem]" style={{ color: 'var(--muted)' }}>
          No BMTC routes found within a 500 m walk of {stationName}.
        </p>
      </Panel>
    );
  }

  const shown = expanded ? buses : buses.slice(0, INITIAL);
  const feeders = buses.filter(isFeeder).length;

  return (
    <Panel
      id="buses"
      icon={<BusIcon size={16} />}
      title="Buses from here"
      meta={`${buses.length} routes${feeders > 0 ? ` · ${feeders} feeder` : ''}`}
    >
      <ul>
        {shown.map((b) => (
          <li
            key={`${b.route}-${b.stopName}`}
            className="py-3 first:pt-0"
            style={{ borderTop: '1px solid var(--rule)' }}
          >
            <div className="flex items-baseline gap-2">
              <span
                className="num shrink-0 px-1.5 py-px text-[0.8125rem] font-semibold"
                style={{
                  fontFamily: 'var(--font-mono), monospace',
                  borderRadius: 'var(--r-sm)',
                  // Metro feeders are the routes that exist to connect to this
                  // station, so they get the accent.
                  background: isFeeder(b) ? 'var(--accent)' : 'var(--surface)',
                  color: isFeeder(b) ? 'var(--on-accent)' : 'var(--ink)',
                }}
              >
                {b.route}
              </span>
              <span className="min-w-0 flex-1 truncate text-[0.875rem]">{b.destinations}</span>
            </div>

            <div
              className="num mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[0.75rem]"
              style={{ color: 'var(--muted)', fontFamily: 'var(--font-mono), monospace' }}
            >
              <span>every ~{b.headway} min</span>
              <span>{formatMinutes(b.firstBus)}–{formatMinutes(b.lastBus)}</span>
              <span>{b.trips} trips/day</span>
              <span className="truncate">{b.stopDistance} m · {b.stopName}</span>
            </div>
          </li>
        ))}
      </ul>

      {buses.length > INITIAL && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="tap mt-1 w-full text-[0.8125rem] font-medium"
          style={{ borderTop: '1px solid var(--rule)', color: 'var(--accent)' }}
        >
          {expanded ? 'Show fewer routes' : `Show all ${buses.length} routes`}
        </button>
      )}

      <p className="pt-3 text-[0.75rem] leading-relaxed" style={{ color: 'var(--muted)' }}>
        BMTC data is community-scraped from the Namma BMTC app and its timetables are known to be
        inaccurate — treat frequencies as a guide, not a schedule. &ldquo;MF&rdquo; routes are
        metro feeders.
      </p>
    </Panel>
  );
}

/** BMTC prefixes metro-feeder routes with MF. */
function isFeeder(b: BusRoute): boolean {
  return /^MF/i.test(b.route);
}
