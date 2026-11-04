'use client';

import { useEffect, useState } from 'react';
import type { CalendarOverrides, FareWindows, Line, StationTimetable } from '@/types/transit';
import { isPeak } from '@/lib/fares';
import { nextDepartures, type DirectionGroup } from '@/lib/departures';
import {
  clockParts, formatMinutes, formatRelative, nowInBengaluru, servicePatternFor,
} from '@/lib/time';
import { FlipTime } from './FlipTime';
import { lineVar } from './primitives';
import { TrainIcon } from './icons';
import { Panel } from './Panel';

const PATTERN_LABEL: Record<string, string> = {
  weekday: 'Weekday service',
  monday: 'Monday service',
  sunday: 'Sunday service',
  holiday: 'Holiday service',
};

export function DepartureBoard({
  timetable, overrides, lines, fareWindows,
}: {
  timetable: StationTimetable; overrides: CalendarOverrides; lines: Line[];
  fareWindows?: FareWindows;
}) {
  // "Now" only exists on the client; rendering it during SSR would ship a stale
  // time and mismatch on hydration.
  const [now, setNow] = useState<ReturnType<typeof nowInBengaluru> | null>(null);

  useEffect(() => {
    const tick = () => setNow(nowInBengaluru());
    tick();
    const id = setInterval(tick, 20_000);
    return () => clearInterval(id);
  }, []);

  if (!now) {
    return (
      <div className="py-8 text-center text-sm" style={{ color: 'var(--muted)' }}>
        Reading the timetable…
      </div>
    );
  }

  const groups = nextDepartures({ timetable, overrides, date: now.date, minutes: now.minutes });
  const pattern = servicePatternFor(now.date, overrides, now.weekday);

  return (
    <Panel
      icon={<TrainIcon size={16} />}
      title="Next trains"
      accent={groups[0] ? lineVar(groups[0].line) : undefined}
      meta={<span className="num" >
        {PATTERN_LABEL[pattern]} · {formatMinutes(now.minutes)}
      </span>}
    >
      <div className="flex flex-col gap-2.5">
          {groups.map((g) => (
          <DirectionBlock
            key={`${g.line}:${g.direction}`}
            group={g}
            lines={lines}
            // Marks which departures fall in a peak-fare window, so "wait and
            // save" is visible without opening the fare panel.
            peakAt={fareWindows
              ? (m: number) => isPeak(fareWindows, pattern, m % 1440)
              : undefined}
          />
        ))}
      </div>

      <p className="pt-3 text-[0.75rem] leading-relaxed" style={{ color: 'var(--muted)' }}>
        Scheduled times from BMRCL&rsquo;s published timetable — not live train positions.
        BMRCL publishes no realtime feed.
      </p>
    </Panel>
  );
}

function DirectionBlock({
  group: g, lines, peakAt,
}: { group: DirectionGroup; lines: Line[]; peakAt?: (minutes: number) => boolean }) {
  const next = g.upcoming[0];
  const rest = g.upcoming.slice(1);
  const lineLabel = lines.find((l) => l.id === g.line)?.name ?? g.line;
  const colour = lineVar(g.line);
  const relative = next
    ? (next.nextDay && next.inMinutes > 180 ? 'tomorrow' : formatRelative(next.inMinutes))
    : null;
  const imminent = next !== undefined && !next.nextDay && next.inMinutes <= 2;

  return (
    <div className="tile relative overflow-hidden">
      {/* The line's colour as the tile's spine, like the strip on a platform sign. */}
      <span className="absolute inset-y-0 left-0 w-1" style={{ background: colour }} aria-hidden />

      <div className="py-3.5 pl-5 pr-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em]" style={{ color: colour }}>
              {lineLabel} line
            </p>
            <p className="mt-0.5 text-[1rem] font-semibold leading-snug tracking-[-0.01em]">
              To {g.primaryHeadsign}
            </p>
          </div>
          {/* Which platform: the question you have in the ten seconds after
              tapping in, and the feed has known it all along. */}
          {g.platform && (
            <span
              className="num shrink-0 rounded-md px-2 py-1 text-[0.75rem] font-semibold"
              style={{ background: 'var(--sunken)', border: '1px solid var(--rule)' }}
            >
              P{g.platform}
            </span>
          )}
        </div>

        {g.serviceEnded ? (
          <p className="mt-3 text-[0.875rem]" style={{ color: 'var(--muted)' }}>
            Service has ended for today.
          </p>
        ) : null}

        {next && (
          // The single number you are squinting at: the largest thing on the page.
          <div className="mt-3 flex items-end justify-between gap-3">
            <span className="num text-[2.5rem] font-semibold leading-none tracking-[-0.04em]">
              {/*
                Split-flap, because that is what the board above the platform
                does. A flap turns exactly when that digit changes, so movement
                here means a departure has actually moved on.
              */}
              <FlipTime
                value={clockParts(next.scheduled).time}
                ariaLabel={`${clockParts(next.scheduled).time} ${clockParts(next.scheduled).meridiem}`}
              />
              <span className="ml-1 text-[0.9375rem] font-medium tracking-normal" style={{ color: 'var(--muted)' }}>
                {clockParts(next.scheduled).meridiem}
              </span>
            </span>
            <span className="flex flex-col items-end gap-1">
              <span
                className="rounded-full px-2.5 py-1 text-[0.8125rem] font-semibold"
                style={imminent
                  ? { background: 'var(--ink)', color: 'var(--ground)' }
                  : { background: 'var(--brand-gradient)', color: '#ffffff', boxShadow: 'var(--glow)' }}
              >
                {relative}
              </span>
              {peakAt?.(next.scheduled) && (
                <span
                  className="text-[0.625rem] font-semibold uppercase tracking-wide"
                  style={{ color: 'var(--warn)' }}
                  title="Peak fare — a smart card is cheaper off-peak"
                >
                  peak fare
                </span>
              )}
            </span>
          </div>
        )}

        {next && next.headsign !== g.primaryHeadsign && (
          <p className="mt-1.5 text-[0.75rem]" style={{ color: 'var(--warn)' }}>
            Short loop — terminates {next.headsign}
          </p>
        )}

        {rest.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {rest.map((u, i) => (
              <li
                key={i}
                className="num rounded-md px-2 py-1 text-[0.75rem]"
                style={{ background: 'var(--sunken)', color: 'var(--muted)' }}
                title={u.headsign !== g.primaryHeadsign ? `Terminates ${u.headsign}` : undefined}
              >
                {formatMinutes(u.scheduled)}
                {u.headsign !== g.primaryHeadsign && <span style={{ color: 'var(--warn)' }}> ·short</span>}
              </li>
            ))}
          </ul>
        )}

        <p
          className="num mt-3 text-[0.6875rem]"
          style={{ color: 'var(--muted)' }}
        >
          First {formatMinutes(g.firstTrain)} · Last {formatMinutes(g.lastTrain)}
        </p>
      </div>
    </div>
  );
}
