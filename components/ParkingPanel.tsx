import { PARKING_RATES, type Station } from '@/types/transit';
import { Car, TwoWheeler } from './primitives';
import { ParkingIcon } from './icons';
import { CapacityBar, Panel } from './Panel';

/**
 * Parking is the one thing here that neither Google Maps nor BMRCL's own app
 * surfaces, so it gets real estate rather than a footnote.
 */
export function ParkingPanel({
  station, maxTwoWheeler, maxFourWheeler,
}: { station: Station; maxTwoWheeler: number; maxFourWheeler: number }) {
  const p = station.parking;
  const r = PARKING_RATES;

  return (
    <Panel id="parking" icon={<ParkingIcon size={16} />} title="Parking"
      meta={p ? `${(p.twoWheeler + p.fourWheeler).toLocaleString('en-IN')} spaces` : 'None'}>

      {!p ? (
        <div className="py-1">
          <p className="text-[0.9375rem]">No parking at this station.</p>
          <p className="mt-1 text-[0.8125rem]" style={{ color: 'var(--muted)' }}>
            BMRCL does not list a facility here — plan to arrive on foot, by bus or by auto.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4">
            <Capacity icon={<TwoWheeler />} label="Two-wheeler" value={p.twoWheeler}
              max={maxTwoWheeler} colour="var(--accent)" />
            <Capacity
              icon={<Car />}
              label="Four-wheeler"
              value={p.fourWheeler}
              max={maxFourWheeler}
              colour="var(--good)"
              // Many stations are two-wheeler only; saying so prevents a wasted drive.
              empty="Not available"
            />
          </div>

          <table className="num mt-5 w-full text-[0.8125rem]" style={{ fontFamily: 'var(--font-mono), monospace' }}>
            <caption className="sr-only">Parking charges</caption>
            <thead>
              <tr className="eyebrow" style={{ color: 'var(--muted)' }}>
                <th scope="col" className="pb-1 text-left font-semibold">Rate</th>
                <th scope="col" className="pb-1 text-right font-semibold">First 4 h</th>
                <th scope="col" className="pb-1 text-right font-semibold">Extra /h</th>
                <th scope="col" className="pb-1 text-right font-semibold">Day max</th>
              </tr>
            </thead>
            <tbody>
              <RateRow label="Two-wheeler" rate={r.twoWheeler} />
              <RateRow label="Four-wheeler" rate={r.fourWheeler} />
            </tbody>
          </table>

          <p className="mt-3 text-[0.75rem] leading-relaxed" style={{ color: 'var(--muted)' }}>
            Cycles free · no overnight parking. Capacity is how many spaces exist, not how many
            are free right now — BMRCL publishes no occupancy data. Rates checked {r.lastVerified}.
          </p>
        </>
      )}
    </Panel>
  );
}

function Capacity({
  icon, label, value, max, colour, empty,
}: {
  icon: React.ReactNode; label: string; value: number; max: number; colour: string;
  empty?: string;
}) {
  return (
    <div className="py-1">
      <div className="eyebrow flex items-center gap-1.5">
        <span style={{ color: 'var(--muted)' }}>{icon}</span>
        {label}
      </div>
      {value > 0 ? (
        <div
          className="num mt-1 text-[1.75rem] font-semibold leading-none"
          style={{ fontFamily: 'var(--font-mono), monospace' }}
        >
          {value.toLocaleString('en-IN')}
          <span className="ml-1 text-[0.75rem] font-normal" style={{ color: 'var(--muted)' }}>
            spaces
          </span>
        </div>
      ) : (
        <div className="mt-1 text-[0.9375rem]" style={{ color: 'var(--muted)' }}>
          {empty ?? 'None'}
        </div>
      )}
      {value > 0 && <CapacityBar value={value} max={max} colour={colour} />}
    </div>
  );
}

function RateRow({
  label, rate,
}: { label: string; rate: { firstFourHours: number; perExtraHour: number; dailyMax: number } }) {
  return (
    <tr style={{ borderTop: '1px solid var(--rule)' }}>
      <th scope="row" className="py-1.5 text-left font-normal" style={{ color: 'var(--muted)' }}>
        {label}
      </th>
      <td className="py-1.5 text-right">₹{rate.firstFourHours}</td>
      <td className="py-1.5 text-right">₹{rate.perExtraHour}</td>
      <td className="py-1.5 text-right font-semibold">₹{rate.dailyMax}</td>
    </tr>
  );
}
