'use client';

import { useEffect, useState } from 'react';
import type { CalendarOverrides, NetworkStatus } from '@/types/transit';
import { formatMinutes, nowInBengaluru, previousDate, servicePatternFor } from '@/lib/time';

const PATTERN_LABEL: Record<string, string> = {
  weekday: 'Weekday service',
  monday: 'Monday service',
  sunday: 'Sunday service',
  holiday: 'Holiday service',
};

/**
 * Live service state for the whole network. The only genuinely moving part of
 * the page, so it earns the animation — a pulsing dot when trains are running.
 */
export function NetworkPulse({
  network, overrides,
}: { network: NetworkStatus; overrides: CalendarOverrides }) {
  const [now, setNow] = useState<ReturnType<typeof nowInBengaluru> | null>(null);

  useEffect(() => {
    const tick = () => setNow(nowInBengaluru());
    tick();
    const id = setInterval(tick, 20_000);
    return () => clearInterval(id);
  }, []);

  // Reserve the row's height during SSR so the hero does not jump on hydration.
  if (!now) return <div className="h-6" aria-hidden />;

  const pattern = servicePatternFor(now.date, overrides, now.weekday);
  const span = network.patterns[pattern];

  // Today's own service window.
  const inTodaySpan = now.minutes >= span.firstTrain && now.minutes <= span.lastTrain;

  // Just after midnight, the trains still out belong to YESTERDAY's service day
  // (a 00:26 last train is stored as 1466). Checking today's span alone would
  // report the network closed while trains are still running.
  const yesterday = network.patterns[servicePatternFor(previousDate(now.date), overrides)];
  const inOvernightTail = now.minutes + 1440 <= yesterday.lastTrain;

  const running = inTodaySpan || inOvernightTail;
  const endsAt = inOvernightTail ? yesterday.lastTrain - 1440 : span.lastTrain;
  const closingSoon = running && endsAt - now.minutes <= 45;

  return (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[0.8125rem]">
      <span className="flex items-center gap-2">
        <span className="relative flex h-2 w-2" aria-hidden>
          {running && (
            <span
              className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
              style={{ background: running ? 'var(--good)' : 'var(--muted)' }}
            />
          )}
          <span
            className="relative inline-flex h-2 w-2 rounded-full"
            style={{ background: running ? 'var(--good)' : 'var(--muted)' }}
          />
        </span>
        <span className="font-semibold">
          {running ? 'Trains running now' : 'Network closed'}
        </span>
      </span>

      <span style={{ color: 'var(--muted)' }}>
        {running
          ? <>{PATTERN_LABEL[pattern]} · last trains {formatMinutes(span.lastTrain)}</>
          : <>First trains {formatMinutes(span.firstTrain)}</>}
      </span>

      {closingSoon && (
        <span className="font-semibold" style={{ color: '#e0ab4a' }}>
          Service ends within the hour
        </span>
      )}
    </div>
  );
}
