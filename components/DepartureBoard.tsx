'use client';

import { useEffect, useState } from 'react';
import type { CalendarOverrides, FareWindows, Line, StationTimetable } from '@/types/transit';
import { isPeak } from '@/lib/fares';
import {
  leaveNow, nextDepartures, serviceResumes, thisService, type DirectionGroup,
} from '@/lib/departures';
import { useWalkMinutes } from '@/lib/useWalkMinutes';
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
  timetable, overrides, lines, fareWindows, stationLat, stationLon,
}: {
  timetable: StationTimetable; overrides: CalendarOverrides; lines: Line[];
  fareWindows?: FareWindows; stationLat: number; stationLon: number;
}) {
  const walk = useWalkMinutes(stationLat, stationLon);
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
    // The shape of the board, so the page does not jump when it fills in.
    return (
      <Panel icon={<TrainIcon size={16} />} title="Next trains">
        <div className="grid gap-2.5" role="status">
          <span className="sr-only">Reading the timetable…</span>
          {[0, 1].map((i) => (
            <div key={i} className="tile flex flex-col gap-3 py-4 pl-5 pr-4">
              <span className="skeleton h-3 w-24" />
              <span className="skeleton h-4 w-48" />
              <span className="skeleton h-10 w-32" />
            </div>
          ))}
        </div>
      </Panel>
    );
  }

  const groups = nextDepartures({ timetable, overrides, date: now.date, minutes: now.minutes });
  // A deeper list only for the walk: a 20 minute walk can skip several trains.
  const resumes = serviceResumes(groups);
  const plan = walk !== null && !resumes
    ? leaveNow(nextDepartures({ timetable, overrides, date: now.date, minutes: now.minutes, limit: 8 }), walk)
    : null;
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
      {resumes && (
        <div className="mb-3 flex items-center gap-3 px-3.5 py-3"
          style={{ borderRadius: 'var(--r-md)', background: 'var(--sunken)', border: '1px solid var(--rule)' }}>
          <MoonIcon />
          <p className="min-w-0 text-[0.875rem] leading-snug">
            <strong>The metro is closed for the night.</strong>{' '}
            <span style={{ color: 'var(--muted)' }}>
              Service resumes at {formatMinutes(resumes.scheduled)} ({formatRelative(resumes.inMinutes)}).
            </span>
          </p>
        </div>
      )}

      {plan && (
        <div className="mb-3 flex items-center gap-3 px-3.5 py-3"
          style={{ borderRadius: 'var(--r-md)', background: 'var(--brand-gradient)', color: '#ffffff', boxShadow: 'var(--glow)' }}>
          <WalkIcon />
          <p className="min-w-0 flex-1 text-[0.8125rem] leading-snug">
            <strong className="block text-[1.0625rem]">
              {plan.leaveIn === 0 ? 'Leave now' : `Leave in ${plan.leaveIn} min`}
            </strong>
            <span className="opacity-85">
              {walk} min walk to catch the {formatMinutes(plan.train.scheduled)} to {plan.group.primaryHeadsign}
            </span>
          </p>
        </div>
      )}

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
  // Only this service's: after the last train, the morning's 6:20 is not "next".
  const rest = thisService(g.upcoming).slice(1);
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

        {g.serviceEnded && next && (
          <div className="mt-3">
            <p className="text-[0.875rem] font-semibold">Not running now</p>
            <p className="num mt-0.5 text-[0.8125rem]" style={{ color: 'var(--muted)' }}>
              First train {formatMinutes(next.scheduled)} · {formatRelative(next.inMinutes)}
            </p>
          </div>
        )}

        {next && !g.serviceEnded && (
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

        {rest.length > 0 && !g.serviceEnded && (
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

function MoonIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden
      className="shrink-0" style={{ color: 'var(--muted)' }}>
      <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
    </svg>
  );
}

function WalkIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0">
      <circle cx="13" cy="4.5" r="2" />
      <path d="M10 21l2-6 3 3v3M9 12l1.5-4.5L14 9l2 3M7 21l2.5-7" />
    </svg>
  );
}
