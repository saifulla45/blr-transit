/**
 * Shared card for station-page sections.
 *
 * The page was a stack of headings and hairlines, which reads as undifferentiated
 * text. A card gives each section an edge, and the tinted icon chip gives it an
 * identity you can find while scrolling.
 */
export function Panel({
  icon, title, meta, accent, children, id,
}: {
  icon: React.ReactNode;
  title: string;
  meta?: React.ReactNode;
  /** Tints the icon chip; defaults to the app accent. */
  accent?: string;
  children: React.ReactNode;
  id?: string;
}) {
  const tint = accent ?? 'var(--accent)';

  return (
    <section
      id={id}
      // No overflow-hidden: it clipped the search suggestions inside this card.
      // Nothing here needs clipping — the header has no fill or radius of its
      // own, only a bottom border.
      className="scroll-mt-16"
      style={{
        borderRadius: 'calc(var(--r-md) * 2)',
        background: 'var(--surface)',
        border: '1px solid var(--rule)',
      }}
    >
      <header
        className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3"
        style={{ borderBottom: '1px solid var(--rule)' }}
      >
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center"
          style={{
            borderRadius: 'var(--r-md)',
            // Tinted rather than solid: several saturated chips down the page
            // would compete with the line colours that carry real meaning.
            background: `color-mix(in srgb, ${tint} 16%, transparent)`,
            color: tint,
          }}
        >
          {icon}
        </span>
        <h2 className="text-[0.9375rem] font-semibold">{title}</h2>
        {meta && <span className="ml-auto text-[0.75rem]" style={{ color: 'var(--muted)' }}>{meta}</span>}
      </header>

      <div className="px-4 py-3">{children}</div>
    </section>
  );
}

/**
 * A capacity bar, scaled against the biggest lot on the network.
 *
 * Turns "110 spaces" into something you can judge — 110 reads very differently
 * once you can see it against Mysore Road's 1,090.
 */
export function CapacityBar({
  value, max, colour,
}: { value: number; max: number; colour: string }) {
  const pct = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return (
    <div
      className="mt-2 h-1.5 w-full overflow-hidden"
      style={{ borderRadius: 999, background: 'var(--rule)' }}
      role="img"
      aria-label={`${value} of the network's largest ${max}`}
    >
      <div style={{ width: `${pct}%`, height: '100%', background: colour, borderRadius: 999 }} />
    </div>
  );
}
