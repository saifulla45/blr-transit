/**
 * Namma Commute mark.
 *
 * "Namma" means *our*, so the mark carries people, not just track.
 *
 * A transit roundel — the form that reads as "metro" anywhere — with the ring
 * broken into three arcs in the Purple, Green and Yellow of the real Bengaluru
 * network, and a figure standing on a platform edge inside it. Three lines
 * around one person: our metro.
 *
 * The platform bar is load-bearing: without it, a figure inside a circle reads
 * as a generic account avatar rather than as transit.
 */
const RING = { cx: 24, cy: 24, r: 16.6, dash: '28.9 75.4' };

export function LogoMark({ size = 56 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      role="img"
      aria-label="Namma Commute"
      
    >
      {/* Backing disc so the mark holds its own over a photograph. */}
      <circle cx="24" cy="24" r="21" fill="#0a0a0a" />

      {/* Ring as three equal arcs, one per line. Drawn with a dash pattern
          rather than three arc paths — same result, far less trigonometry to
          get wrong. Rotated so the gaps fall off the vertical axis. */}
      <g
        transform={`rotate(-90 ${RING.cx} ${RING.cy})`}
        strokeWidth="5.6"
        strokeLinecap="round"
        fill="none"
      >
        <circle {...arc()} stroke="#c264d8" strokeDashoffset="0" />
        <circle {...arc()} stroke="#45cf78" strokeDashoffset="-34.75" />
        <circle {...arc()} stroke="#e8c552" strokeDashoffset="-69.5" />
      </g>

      {/* The figure on the platform edge — the "namma". */}
      <g fill="#ffffff">
        <circle cx="24" cy="17.1" r="3.5" />
        <path d="M16.9 29.6c0-3.9 3.2-7.1 7.1-7.1s7.1 3.2 7.1 7.1z" />
        <rect x="13.2" y="31.4" width="21.6" height="3.3" rx="1.65" />
      </g>
    </svg>
  );
}

function arc() {
  return { cx: RING.cx, cy: RING.cy, r: RING.r, strokeDasharray: RING.dash };
}

/** Mark plus wordmark, for the page header. */
export function Logo() {
  return (
    <span className="flex items-center gap-2.5 md:gap-3">
      <span className="shrink-0">
        {/* Larger on desktop where the hero has room to carry it. */}
        <span className="block md:hidden"><LogoMark size={40} /></span>
        <span className="hidden md:block"><LogoMark size={48} /></span>
      </span>
      <span className="leading-none">
        <span className="block text-[1.0625rem] font-bold leading-none tracking-[-0.015em] md:text-[1.25rem]">
          Namma Commute
        </span>
        <span
          className="mt-1 block text-[0.5625rem] font-semibold uppercase leading-none tracking-[0.2em] md:text-[0.625rem]"
          style={{ color: 'var(--muted)' }}
        >
          Our metro, Bengaluru
        </span>
      </span>
    </span>
  );
}
