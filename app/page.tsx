import { Browse } from '@/components/Browse';
import { AppBar } from '@/components/AppBar';
import { SiteFooter } from '@/components/SiteFooter';
import {
  getFareWindows, getLiveNetwork, getNetwork, getOverrides, getStationsIndex,
} from '@/lib/data';

export default async function HomePage() {
  const [{ stations, lines, feedVersion }, overrides, network, fareWindows, live] =
    await Promise.all([
      getStationsIndex(), getOverrides(), getNetwork(), getFareWindows(), getLiveNetwork(),
    ]);
  const withParking = stations.filter((s) => s.parking).length;

  return (
    <main className="min-h-[100dvh]">
      <AppBar overlay />
      {/* Browse owns the hero because the locate/search controls inside it share
          state with the results below. */}
      <Browse
        stations={stations}
        lines={lines}
        network={network}
        overrides={overrides}
        fareWindows={fareWindows}
        live={live}
      />

      <SiteFooter>
        <p>
          Parking capacity for {withParking} of {stations.length} stations, from BMRCL. Train
          times are <strong>scheduled</strong>, from BMRCL&rsquo;s published timetable (feed{' '}
          <span className="num" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {feedVersion}
          </span>
          ) — BMRCL publishes no live feed, so nothing here is realtime.
        </p>
        <p className="mt-2">
          Timetables{' '}
          <a className="underline" href="https://github.com/Vonter/bmrcl-gtfs">Vonter/bmrcl-gtfs</a>{' '}
          (ODbL 1.0) · parking{' '}
          <a className="underline" href="https://english.bmrc.co.in/parking/">BMRCL</a> · places
          and map data © OpenStreetMap contributors.
        </p>
      </SiteFooter>
    </main>
  );
}
