'use client';

import { useEffect, useState } from 'react';
import { BusIcon, ParkingIcon, PinIcon, TicketIcon, TrainIcon } from './icons';

// Same order as the page itself, or the highlight tracks the wrong section.
const SECTIONS = [
  { id: 'fare', label: 'Fare', Icon: TicketIcon },
  { id: 'buses', label: 'Buses', Icon: BusIcon },
  { id: 'departures', label: 'Trains', Icon: TrainIcon },
  { id: 'parking', label: 'Parking', Icon: ParkingIcon },
  { id: 'entrances', label: 'Exits', Icon: PinIcon },
  { id: 'nearby', label: 'Nearby', Icon: PinIcon },
];

/** Jump nav that tracks which section is in view. */
export function SectionNav({ hasBuses }: { hasBuses: boolean }) {
  const items = SECTIONS.filter((s) => s.id !== 'buses' || hasBuses);
  const [active, setActive] = useState(items[0].id);

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        const top = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (top) setActive(top.target.id);
      },
      // Bias towards the upper third so the highlight matches what you're reading.
      { rootMargin: '-15% 0px -70% 0px' },
    );
    for (const s of items) {
      const el = document.getElementById(s.id);
      if (el) io.observe(el);
    }
    return () => io.disconnect();
  }, [items]);

  return (
    <nav
      className="sticky top-0 z-20 -mx-5 mb-1 px-5 py-2 backdrop-blur md:-mx-8 md:px-8"
      style={{ background: 'color-mix(in srgb, var(--ground) 88%, transparent)' }}
      aria-label="Sections"
    >
      <ul className="flex overflow-x-auto">
        {items.map((s) => (
          <li key={s.id}>
            <a
              href={`#${s.id}`}
              aria-current={active === s.id ? 'true' : undefined}
              className="flex shrink-0 items-center gap-1 px-2 py-1.5 text-[0.8125rem] font-medium transition-colors"
              style={{
                borderRadius: 'var(--r-md)',
                background: active === s.id ? 'var(--ink)' : 'transparent',
                color: active === s.id ? 'var(--ground)' : 'var(--muted)',
              }}
            >
              <s.Icon size={14} />
              {s.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
