'use client';

import { useEffect, useState } from 'react';
import type { CalendarOverrides, StationTimetable } from '@/types/transit';
import { nextDepartures } from '@/lib/departures';
import { clockParts, formatRelative, nowInBengaluru } from '@/lib/time';
import { lineVar } from './primitives';
import { TrainIcon } from './icons';

/**
 * Condensed next-train bar that appears once the departure board scrolls away.
 *
 * The whole point of the page is the next train; without this you lose it the
 * moment you scroll down to check parking or buses.
 */
export function StickyNextTrain({
  timetable, overrides, stationName,
}: { timetable: StationTimetable; overrides: CalendarOverrides; stationName: string }) {
  const [now, setNow] = useState<ReturnType<typeof nowInBengaluru> | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const tick = () => setNow(nowInBengaluru());
    tick();
    const id = setInterval(tick, 20_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const board = document.getElementById('departures');
    if (!board) return;
    // Show the bar only once the real board has left the viewport.
    const io = new IntersectionObserver(
      ([entry]) => setVisible(!entry.isIntersecting),
      { rootMargin: '-72px 0px 0px 0px' },
    );
    io.observe(board);
    return () => io.disconnect();
  }, []);

  if (!now) return null;

  const groups = nextDepartures({
    timetable, overrides, date: now.date, minutes: now.minutes, limit: 1,
  });
  const upcoming = groups
    .map((g) => ({ g, u: g.upcoming[0] }))
    .filter((x) => x.u)
    .sort((a, b) => a.u.inMinutes - b.u.inMinutes)
    .slice(0, 2);

  if (upcoming.length === 0) return null;

  return (
    <div
      aria-hidden={!visible}
      className="safe-bottom pointer-events-none fixed inset-x-0 bottom-0 z-30 px-4 pb-4 transition-all duration-200"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(0.75rem)',
      }}
    >
      <div
        className="pointer-events-auto mx-auto max-w-[34rem] px-4 py-3"
        style={{
          borderRadius: 'var(--r-lg)',
          background: 'linear-gradient(160deg, #011f20, #0b5254)',
          color: '#ffffff',
          boxShadow: 'var(--shadow-pop)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
        }}
      >
        {/* Labelled: without this the bar is two bare times with no indication
            of what they are or which station they belong to. */}
        <div className="flex items-center gap-1.5 pb-1.5 opacity-60">
          <TrainIcon size={13} />
          <span className="text-[0.625rem] font-semibold uppercase tracking-[0.1em]">
            Next trains from {stationName}
          </span>
        </div>

        <div className="flex items-center gap-4">
        {upcoming.map(({ g, u }) => (
          <a
            key={`${g.line}:${g.direction}`}
            href="#departures"
            className="min-w-0 flex-1"
          >
            <div className="flex items-center gap-1.5">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: lineVar(g.line) }}
                aria-hidden
              />
              <span className="truncate text-[0.6875rem] uppercase tracking-wide opacity-70">
                {g.primaryHeadsign}
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span
                className="num text-[1.125rem] font-semibold"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {clockParts(u.scheduled).time}
                <span className="ml-0.5 text-[0.6875rem] font-medium opacity-70">
                  {clockParts(u.scheduled).meridiem}
                </span>
              </span>
              <span className="text-[0.75rem] opacity-70">
                {u.nextDay && u.inMinutes > 180 ? 'tomorrow' : formatRelative(u.inMinutes)}
              </span>
            </div>
          </a>
        ))}
        </div>
      </div>
    </div>
  );
}
