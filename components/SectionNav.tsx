'use client';

import { useEffect, useRef, useState } from 'react';
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
  const listRef = useRef<HTMLUListElement | null>(null);

  // Keep the highlighted section visible in the scrolling bar on a phone.
  useEffect(() => {
    const list = listRef.current;
    const link = list?.querySelector<HTMLElement>(`a[href="#${active}"]`);
    if (!list || !link) return;
    list.scrollTo({ left: link.offsetLeft - (list.clientWidth - link.offsetWidth) / 2, behavior: 'smooth' });
  }, [active]);

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
      className="sticky top-[calc(3.5rem+max(0.5rem,env(safe-area-inset-top)))] z-20 -mx-5 mb-1 px-5 py-2.5 md:-mx-8 md:px-8"
      style={{
        background: 'color-mix(in srgb, var(--ground) 93%, transparent)',
        backdropFilter: 'blur(16px) saturate(1.4)',
        WebkitBackdropFilter: 'blur(16px) saturate(1.4)',
      }}
      aria-label="Sections"
    >
      <ul ref={listRef} className="scroll-x relative flex w-fit max-w-full gap-1 rounded-full p-1"
        style={{ background: 'var(--surface)', border: '1px solid var(--rule)', boxShadow: 'var(--shadow-card)' }}>
        {items.map((s) => (
          <li key={s.id}>
            <a
              href={`#${s.id}`}
              aria-current={active === s.id ? 'true' : undefined}
              className="press flex shrink-0 items-center gap-1.5 whitespace-nowrap px-3 py-1.5 text-[0.8125rem] font-semibold"
              style={{
                borderRadius: 999,
                background: active === s.id ? 'var(--brand-gradient)' : 'transparent',
                color: active === s.id ? '#ffffff' : 'var(--muted)',
                boxShadow: active === s.id ? 'var(--glow)' : 'none',
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
