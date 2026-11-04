/**
 * Shared card for station-page sections.
 *
 * The page was a stack of headings and hairlines, which reads as undifferentiated
 * text. A card gives each section an edge. Every chip is the brand teal — a
 * different colour per section read as noise — and the departure board alone
 * passes its line colour.
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
  const [chipA, chipB] = accent
    ? [accent, `color-mix(in srgb, ${accent} 70%, #01292a)`]
    : ['#0b5556', '#013536'];

  return (
    <section
      id={id}
      // No overflow-hidden: it clipped the search suggestions inside this card.
      // Nothing here needs clipping — the header has no fill or radius of its
      // own, only a bottom border.
      className="card scroll-mt-20"
    >
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 pb-2 pt-4 md:px-5">
        <span
          className="chip-grad h-9 w-9 shrink-0"
          style={{ ['--chip-a' as string]: chipA, ['--chip-b' as string]: chipB }}
        >
          {icon}
        </span>
        <h2 className="text-[1.125rem] font-bold tracking-[-0.02em]">{title}</h2>
        {meta && (
          <span
            className="ml-auto rounded-full px-2.5 py-1 text-[0.6875rem] font-medium"
            style={{ color: 'var(--muted)', background: 'var(--sunken)', border: '1px solid var(--rule)' }}
          >
            {meta}
          </span>
        )}
      </header>

      <div className="px-4 pb-4 pt-2 md:px-5">{children}</div>
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
