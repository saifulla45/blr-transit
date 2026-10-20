/**
 * The notice shown to someone outside Bengaluru.
 *
 * This site is deliberately about one city. An earlier version tried to be
 * useful to everyone — it named the visitor's city and offered a grid of
 * eighteen other operators — which turned a Bengaluru tool into a directory
 * of links it does not maintain and cannot vouch for.
 *
 * So: say plainly that the location-based answers do not apply here, and get
 * out of the way. Everything that does not depend on where you are standing —
 * search, all 83 stations, the network map, fares, the journey planner —
 * stays available below, because planning a Bengaluru trip from elsewhere is
 * a perfectly good reason to be on this page.
 *
 * Not a client component any more: with the city lookup gone there is nothing
 * here but text.
 */
export function OutOfArea({ nearestStationKm }: { nearestStationKm: number }) {
  return (
    <section
      className="stop-in min-w-0 md:col-span-2"
      style={{
        borderRadius: 'calc(var(--r-md) * 2)',
        background: 'color-mix(in srgb, var(--warn) 12%, transparent)',
        border: '1px solid color-mix(in srgb, var(--warn) 40%, transparent)',
      }}
    >
      <div className="px-4 py-3.5">
        <p className="text-[0.9375rem] font-semibold" style={{ color: 'var(--warn)' }}>
          You&rsquo;re outside Bengaluru
        </p>
        <p className="mt-1 text-[0.8125rem] leading-relaxed" style={{ color: 'var(--ink)' }}>
          This site covers Bengaluru&rsquo;s Namma Metro only, and the nearest station is{' '}
          <span className="num">{Math.round(nearestStationKm).toLocaleString('en-IN')} km</span>{' '}
          away — so &ldquo;nearest to you&rdquo; has been left out. Everything else works:
          search any station, browse all 83, plan a journey and check fares below.
        </p>
      </div>
    </section>
  );
}
