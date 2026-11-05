'use client';

import { useEffect, useState } from 'react';
import type { CalendarOverrides, StationTimetable } from '@/types/transit';
import { leaveNow, nextDepartures, serviceResumes } from '@/lib/departures';
import { useWalkMinutes } from '@/lib/useWalkMinutes';
import { clockParts, formatMinutes, formatRelative, nowInBengaluru } from '@/lib/time';
import { lineVar } from './primitives';
import { TrainIcon } from './icons';

/**
 * Condensed next-train bar that appears once the departure board scrolls away.
 *
 * The whole point of the page is the next train; without this you lose it the
 * moment you scroll down to check parking or buses. With a location it leads
 * with when to set off; after the last train it says when service resumes
 * instead of quoting tomorrow's times as if they were next.
 */
export function StickyNextTrain({
  timetable, overrides, stationName, stationLat, stationLon,
}: {
  timetable: StationTimetable; overrides: CalendarOverrides; stationName: string;
  stationLat: number; stationLon: number;
}) {
  const walk = useWalkMinutes(stationLat, stationLon);
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
    // Deep enough that a long walk still finds a train it can catch.
    timetable, overrides, date: now.date, minutes: now.minutes, limit: 8,
  });
  const resumes = serviceResumes(groups);
  const plan = walk !== null && !resumes ? leaveNow(groups, walk) : null;
  const upcoming = groups
    // A closed direction's 5:30am first train is not a "next train"; the
    // board says "Not running now" for it, and the bar must not contradict it.
    .filter((g) => resumes || !g.serviceEnded)
    .map((g) => ({ g, u: g.upcoming[0] }))
    .filter((x) => x.u)
    .sort((a, b) => a.u.inMinutes - b.u.inMinutes)
    .slice(0, 2);

  if (upcoming.length === 0) return null;

  return (
    <div
      aria-hidden={!visible}
      // Hidden means unreachable too, not just unannounced.
      inert={!visible}
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
          <span className="truncate text-[0.625rem] font-semibold uppercase tracking-[0.1em]">
            {resumes ? `${stationName} · closed for the night` : `Next trains from ${stationName}`}
          </span>
        </div>

        {plan && (
          <a href="#departures" className="mb-2 flex items-center gap-2.5 rounded-xl px-3 py-2"
            style={{ background: 'rgba(255,255,255,.1)' }}>
            <WalkIcon />
            <span className="min-w-0 flex-1 text-[0.8125rem] leading-snug">
              <strong className="text-[0.9375rem]">
                {plan.leaveIn === 0 ? 'Leave now' : `Leave in ${plan.leaveIn} min`}
              </strong>
              <span className="opacity-75">
                {' '}· {walk} min walk for the {formatMinutes(plan.train.scheduled)}
              </span>
            </span>
          </a>
        )}

        {resumes ? (
          <a href="#departures" className="block">
            <span className="block text-[1.0625rem] font-semibold">
              First train {formatMinutes(resumes.scheduled)}
            </span>
            <span className="block text-[0.75rem] opacity-70">
              Service resumes {formatRelative(resumes.inMinutes)}
            </span>
          </a>
        ) : (
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
        )}
      </div>
    </div>
  );
}

function WalkIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0">
      <circle cx="13" cy="4.5" r="2" />
      <path d="M10 21l2-6 3 3v3M9 12l1.5-4.5L14 9l2 3M7 21l2.5-7" />
    </svg>
  );
}
