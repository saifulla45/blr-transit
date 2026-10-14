'use client';

import { useEffect, useState } from 'react';
import type { CalendarOverrides, FareWindows, Line, StationTimetable } from '@/types/transit';
import { isPeak } from '@/lib/fares';
import { nextDepartures, type DirectionGroup } from '@/lib/departures';
import {
  clockParts, formatMinutes, formatRelative, nowInBengaluru, servicePatternFor,
} from '@/lib/time';
import { lineVar, Rail } from './primitives';
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
      meta={<span className="num" style={{ fontFamily: 'var(--font-mono), monospace' }}>
        {PATTERN_LABEL[pattern]} · {formatMinutes(now.minutes)}
      </span>}
    >
      <div className="flex flex-col">
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

  return (
    <div
      className="flex items-stretch gap-3 py-4 first:pt-1"
      style={{ borderTop: '1px solid var(--rule)' }}
    >
      <Rail line={g.line} />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span
            className="text-[0.6875rem] font-semibold uppercase tracking-wide"
            style={{ color: lineVar(g.line) }}
          >
            {lineLabel}
          </span>
          <span className="text-[1.0625rem] font-semibold leading-tight">
            towards {g.primaryHeadsign}
          </span>
          {/* Which platform — the question you have in the ten seconds after
              tapping in, and the feed has known it all along. */}
          {g.platform && (
            <span
              className="num shrink-0 px-1.5 py-px text-[0.6875rem] font-semibold"
              style={{
                fontFamily: 'var(--font-mono), monospace',
                borderRadius: 'var(--r-sm)',
                background: `color-mix(in srgb, ${lineVar(g.line)} 18%, transparent)`,
                color: lineVar(g.line),
              }}
            >
              Platform {g.platform}
            </span>
          )}
        </div>

        {g.serviceEnded ? (
          <p className="mt-2 text-sm" style={{ color: 'var(--muted)' }}>
            Service has ended for today.
          </p>
        ) : null}

        {next && (
          // The single number you are squinting at: the largest thing on the page.
          <div className="mt-2 flex items-baseline gap-3">
            <span
              className="num text-[2.5rem] font-semibold leading-none tracking-tight"
              style={{ fontFamily: 'var(--font-mono), monospace' }}
            >
              {clockParts(next.scheduled).time}
              <span className="ml-1 text-[1rem] font-medium" style={{ color: 'var(--muted)' }}>
                {clockParts(next.scheduled).meridiem}
              </span>
            </span>
            <span className="text-sm font-medium" style={{ color: 'var(--accent)' }}>
              {next.nextDay && next.inMinutes > 180 ? 'tomorrow' : formatRelative(next.inMinutes)}
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
          </div>
        )}

        {next && next.headsign !== g.primaryHeadsign && (
          <p className="mt-1 text-[0.75rem]" style={{ color: 'var(--warn)' }}>
            Short loop — terminates {next.headsign}
          </p>
        )}

        {rest.length > 0 && (
          <ul
            className="num mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[0.8125rem]"
            style={{ color: 'var(--muted)', fontFamily: 'var(--font-mono), monospace' }}
          >
            {rest.map((u, i) => (
              <li key={i}>
                {formatMinutes(u.scheduled)}
                {u.headsign !== g.primaryHeadsign && (
                  <span style={{ color: 'var(--warn)' }} title={`Terminates ${u.headsign}`}> ·short</span>
                )}
              </li>
            ))}
          </ul>
        )}

        <p
          className="num mt-3 text-[0.75rem]"
          style={{ color: 'var(--muted)', fontFamily: 'var(--font-mono), monospace' }}
        >
          First {formatMinutes(g.firstTrain)} · Last {formatMinutes(g.lastTrain)}
        </p>
      </div>
    </div>
  );
}
