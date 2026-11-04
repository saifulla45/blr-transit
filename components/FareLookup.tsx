'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type {
  CalendarOverrides, FareWindows, Line, Station, StationLite, StationTimetable, TravelPass,
} from '@/types/transit';
import {
  WHATSAPP_TICKET_URL, fareOptions, formatRupees, isPeak, offPeakSaving, type FareTuple,
} from '@/lib/fares';
import { nextDepartures } from '@/lib/departures';
import { lastTrainToward } from '@/lib/lastTrain';
import { clockParts, formatMinutes, nowInBengaluru, servicePatternFor } from '@/lib/time';
import { InterchangeIcon, TicketIcon, WhatsAppIcon } from './icons';
import { JourneyPath } from './JourneyPath';
import { NetworkMap } from './NetworkMap';
import { Panel } from './Panel';
import { StationPicker } from './StationPicker';

/** [minutes, trackKm, interchanges, stationPath] */
type Journey = [number, number, number, string[]];

export function FareLookup({
  origin, stations, lines, fares, journeys, fareWindows, overrides, timetable, passes,
}: {
  origin: Station;
  /** Lean projection: the picker, path and map need no entrance or parking data. */
  stations: StationLite[];
  lines: Line[];
  fares: Record<string, FareTuple>;
  journeys: Record<string, Journey>;
  fareWindows: FareWindows;
  overrides: CalendarOverrides;
  timetable: StationTimetable;
  passes: TravelPass[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  // A journey in the URL survives a reload and can be sent to someone else.
  const initial = stations.find((s) => s.id === params.get('to')) ?? null;
  const [dest, setDest] = useState<StationLite | null>(initial);
  const [copied, setCopied] = useState(false);

  const choose = (s: StationLite | null) => {
    setDest(s);
    setCopied(false);
    // replace, not push: picking destinations should not fill the back stack.
    router.replace(s ? `?to=${s.id}` : '?', { scroll: false });
  };
  const [now, setNow] = useState<ReturnType<typeof nowInBengaluru> | null>(null);

  useEffect(() => {
    const tick = () => setNow(nowInBengaluru());
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  const destId = dest?.id ?? '';
  const fare = destId ? fares[destId] : undefined;
  const journey = destId ? journeys[destId] : undefined;
  const options = stations.filter((s) => s.id !== origin.id);
  // Headsigns name stations; line.order holds ids. This bridges the two.
  const byId = new Map(stations.map((s) => [s.id, s]));

  const pattern = now ? servicePatternFor(now.date, overrides, now.weekday) : null;
  const peak = now && pattern ? isPeak(fareWindows, pattern, now.minutes) : false;

  // The train you'd actually catch, and when it gets you there.
  const groups = now
    ? nextDepartures({ timetable, overrides, date: now.date, minutes: now.minutes, limit: 1 })
    : [];
  const nextOut = groups.map((g) => g.upcoming[0]).filter(Boolean)
    .sort((a, b) => a.inMinutes - b.inMinutes)[0];
  /*
    The last train GOING YOUR WAY, not the last train from this platform.

    This was Math.max over every direction, which at an interchange is the
    latest train on any line to anywhere. From Majestic that is always 23:37,
    while the last train to Challaghatta is 23:19 — eighteen minutes of false
    reassurance, which is a missed last train.
  */
  const lastOut = journey
    ? lastTrainToward(journey[3], journey[2], groups, lines, (id) => byId.get(id)?.name)
    : null;

  return (
    <Panel id="fare" icon={<TicketIcon size={16} />} title="Fare &amp; journey">
      {/*
        Visible, not just a placeholder. The placeholder said "Travelling
        to…" and then vanished the moment a station was chosen, leaving a
        box containing one station name on a page titled with a different
        station name — which is ambiguous in exactly the direction that
        made a one-stop journey look like a bug.
      */}
      <p className="eyebrow pb-1.5">Travelling from {origin.name} to</p>
      <StationPicker
        stations={options}
        value={dest}
        onSelect={choose}
        placeholder="Choose a station…"
        label={`Destination station, travelling from ${origin.name}`}
      />

      {destId && !fare && !journey && (
        <p className="mt-3 text-[0.875rem]" style={{ color: 'var(--muted)' }}>
          No route listed between these stations.
        </p>
      )}

      {destId && (fare || journey) && (
        <div className="mt-4">
          {/*
            The route, stated before the numbers.

            The panel showed a destination picker and then three figures,
            never naming the origin — so "Peenya Industry to Peenya" read as
            a single station, and 0.9km and 10 rupees looked like a bug
            rather than one stop on the Green line. The journey has two ends
            and the page should say both.
          */}
          <p className="pb-3 text-[0.875rem] font-semibold">
            {origin.name}
            <span aria-hidden className="px-1.5" style={{ color: 'var(--muted)' }}>&rarr;</span>
            {dest?.name}
          </p>

          <dl className="grid grid-cols-3 gap-3">
            {/*
              "Fare from" was doubly misleading: it reads as "fare from
              <station>", and taken as "fares start at" it is wrong too,
              since the token shown here is the DEAREST option and the smart
              card below it is cheaper.
            */}
            <Figure label="Token fare" value={fare ? formatRupees(fare[0]) : '—'} />
            <Figure label="Journey" value={journey ? String(journey[0]) : '—'} unit="min" />
            <Figure label="Distance" value={journey ? String(journey[1]) : '—'} unit="km" />
          </dl>

          <p
            className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.75rem]"
            style={{ color: 'var(--muted)' }}
          >
            {journey && journey[2] > 0 ? (
              <span className="flex items-center gap-1 font-medium" style={{ color: 'var(--warn)' }}>
                <InterchangeIcon size={13} />
                {journey[2]} change{journey[2] > 1 ? 's' : ''} of line
              </span>
            ) : (
              <span>Direct — no change of line</span>
            )}
            {journey && <span>· {journey[3].length} stations</span>}
          </p>

          {/* --- What it costs, by how you pay -------------------------------- */}
          {fare && now && (
            <div className="mt-4 pt-3" style={{ borderTop: '1px solid var(--rule)' }}>
              <div className="flex flex-wrap items-baseline justify-between gap-2 pb-2">
                <h3 className="eyebrow">Ways to pay</h3>
                <span
                  className="text-[0.6875rem] font-semibold uppercase tracking-wide"
                  style={{ color: peak ? 'var(--warn)' : 'var(--good)' }}
                >
                  {peak ? 'Peak fare right now' : 'Off-peak fare right now'}
                </span>
              </div>

              <ul className="flex flex-col">
                {fareOptions(fare, peak).map((o) => (
                  <li
                    key={o.media}
                    className="flex items-baseline justify-between gap-3 py-1.5"
                    style={{ borderTop: '1px solid var(--rule)' }}
                  >
                    <span className="text-[0.875rem]">{o.label}</span>
                    <span className="flex items-baseline gap-2">
                      {o.note && (
                        <span className="text-[0.6875rem]" style={{ color: 'var(--good)' }}>
                          {o.note}
                        </span>
                      )}
                      <span
                        className="num text-[0.9375rem] font-semibold"
                        style={{ fontVariantNumeric: 'tabular-nums' }}
                      >
                        {formatRupees(o.amount)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>

              {offPeakSaving(fare, peak) !== null && (
                <p className="mt-2 text-[0.75rem]" style={{ color: 'var(--muted)' }}>
                  Travelling off-peak on a smart card costs{' '}
                  {formatRupees(fare[2])} — {formatRupees(offPeakSaving(fare, peak)!)} less than
                  now. Off-peak is before 8am, 12–4pm, after 9pm, and all day Sunday.
                </p>
              )}

              {/*
                The next thing you do after learning the fare is buy a
                ticket, and the page used to stop short of it. Sold on
                convenience rather than price: the fare table directly above
                prices QR the same as a token, so a discount claim here would
                be contradicted by the numbers beside it.
              */}
              <a
                href={WHATSAPP_TICKET_URL}
                rel="noreferrer"
                className="tap mt-3 flex items-center gap-2.5 px-3"
                style={{
                  borderRadius: 'var(--r-md)',
                  border: '1px solid color-mix(in srgb, var(--good) 40%, transparent)',
                  background: 'color-mix(in srgb, var(--good) 10%, transparent)',
                }}
              >
                <WhatsAppIcon />
                <span className="min-w-0 py-2">
                  <span className="block text-[0.8125rem] font-semibold">
                    Buy a QR ticket on WhatsApp
                  </span>
                  <span className="block text-[0.6875rem]" style={{ color: 'var(--muted)' }}>
                    Skip the queue · no app to install
                  </span>
                </span>
              </a>
            </div>
          )}

          {/* --- When you'd arrive, and the last train ----------------------- */}
          {journey && now && nextOut && (
            <div className="mt-4 pt-3" style={{ borderTop: '1px solid var(--rule)' }}>
              <h3 className="eyebrow pb-1.5">If you leave now</h3>
              <p className="text-[0.875rem]">
                Catch the{' '}
                <strong className="num" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {clockParts(nextOut.scheduled).time}
                  <span className="text-[0.75rem]"> {clockParts(nextOut.scheduled).meridiem}</span>
                </strong>{' '}
                and reach {dest?.name} around{' '}
                <strong className="num" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {clockParts(nextOut.scheduled + journey[0]).time}
                  <span className="text-[0.75rem]">
                    {' '}{clockParts(nextOut.scheduled + journey[0]).meridiem}
                  </span>
                </strong>
                .
              </p>
              {lastOut && (
                <p className="mt-1.5 text-[0.75rem]" style={{ color: 'var(--muted)' }}>
                  Last train towards {dest?.name ?? 'there'} leaves{' '}
                  <strong style={{ color: 'var(--ink)' }}>{formatMinutes(lastOut.minutes)}</strong>
                  {/* The headsign only adds anything when it is NOT the
                      destination — otherwise it reads "towards Challaghatta
                      (towards Challaghatta)". It is the platform sign you
                      look for, so it earns its place on every other route. */}
                  {lastOut.headsign !== dest?.name && <> (the {lastOut.headsign} train)</>}
                  {/* Said plainly rather than implied: the second leg's
                      timetable is not on this page, so the connection is not
                      something this figure can vouch for. */}
                  {lastOut.viaInterchange
                    && ' — you change lines on this route, so leave earlier and check the connection'}
                  .
                </p>
              )}
            </div>
          )}

          {journey?.[3]?.length ? (
            <div className="mt-4 pt-3" style={{ borderTop: '1px solid var(--rule)' }}>
              <p className="eyebrow pb-1">{journey[3].length} stations · every stop on the way</p>
              <JourneyPath path={journey[3]} stations={stations} />
              {/* The same journey spatially — a stop list tells you the order,
                  a map tells you where you are actually going. */}
              <NetworkMap
                stations={stations}
                lines={lines}
                journey={journey[3]}
                interactive={false}
                className="mt-3 h-56 overflow-hidden"
              />
            </div>
          ) : null}

          {/* An unlimited pass only makes sense past a certain number of trips,
              so show the break-even rather than just the price. */}
          {fare && passes.length > 0 && (
            <div className="mt-4 pt-3" style={{ borderTop: '1px solid var(--rule)' }}>
              <h3 className="eyebrow pb-1.5">Unlimited travel passes</h3>
              <ul className="flex flex-col">
                {passes.map((p) => {
                  const trips = Math.ceil(p.amount / fare[0]);
                  return (
                    <li
                      key={p.id}
                      className="flex items-baseline justify-between gap-3 py-1.5"
                      style={{ borderTop: '1px solid var(--rule)' }}
                    >
                      <span className="text-[0.875rem]">{p.days}-day pass</span>
                      <span className="flex items-baseline gap-2">
                        <span className="text-[0.6875rem]" style={{ color: 'var(--muted)' }}>
                          worth it past {trips} trip{trips > 1 ? 's' : ''}
                        </span>
                        <span
                          className="num text-[0.9375rem] font-semibold"
                          style={{ fontVariantNumeric: 'tabular-nums' }}
                        >
                          {formatRupees(p.amount)}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(window.location.href).then(
                () => setCopied(true),
                () => setCopied(false),
              );
            }}
            className="tap mt-4 w-full text-[0.8125rem] font-semibold"
            style={{
              borderRadius: 'var(--r-md)',
              background: 'var(--surface)',
              border: '1px solid var(--rule)',
              color: 'var(--accent)',
            }}
          >
            {copied ? 'Link copied' : 'Copy a link to this journey'}
          </button>

          <p className="mt-4 text-[0.75rem] leading-relaxed" style={{ color: 'var(--muted)' }}>
            Journey time is scheduled running time including stops and any interchange, and
            distance follows the track, not a straight line.
          </p>
        </div>
      )}
    </Panel>
  );
}

function Figure({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="min-w-0">
      <dt className="eyebrow">{label}</dt>
      <dd
        className="num mt-1 flex items-baseline gap-1 whitespace-nowrap text-[1.5rem] font-semibold leading-none"
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {value}
        {unit && (
          <span className="text-[0.75rem] font-medium" style={{ color: 'var(--muted)' }}>
            {unit}
          </span>
        )}
      </dd>
    </div>
  );
}
