# Namma Commute

Find your nearest Bengaluru metro station, its scheduled trains, the fare to
anywhere on the network, what parking costs, and what's within a walk of it.

A free, open civic tool — not a product. See "Why this isn't a business" below.

## What this is and is not

It shows **scheduled** times from BMRCL's published timetables. It is **not**
live tracking: BMRCL publishes no GTFS-Realtime feed, so no application can show
actual train positions today. The UI says "Scheduled 18:47" rather than
"arriving in 5 min" for that reason.

## How it works

There is no backend and no database. A build-time pipeline turns the GTFS feed
and BMRCL's parking page into static JSON, which is inlined into 83 prerendered
station pages. "Next train" is `timetable + now`, computed in the browser from
the device clock — always current, no server required.

```
BMRCL GTFS + BMRCL parking page + BMTC GTFS + OpenStreetMap
        -> scripts/build-data.ts
        -> public/data/*.json
        -> prerendered pages -> Netlify (static export)
```

## Commands

| Command | What it does |
| --- | --- |
| `npm run build:data` | Re-download the feed and regenerate `public/data` |
| `npm run dev` | Dev server (copies the MapLibre worker first) |
| `npm run build` | Production build, prerenders every station |
| `npm test` | Unit tests |
| `npm run test:tz` | Same tests under UTC, New York and Kolkata |

## Things worth knowing before changing this

- **Times are integer minutes since midnight, never strings.**
  `new Date("2026-09-29 05:00")` is `Invalid Date` in Safari but fine in Chrome.
  Keeping times as integers removes that failure mode by construction. All
  `Date` handling lives in `lib/time.ts`.

- **`calendar_dates.txt` is not optional.** BMRCL runs the holiday timetable on
  2nd and 4th Saturdays as well as public holidays — about 40 days a year where
  a plain day-of-week lookup is wrong.

- **Departures are keyed by line *and* direction *and* destination.** Majestic
  and RV Road are served by two lines that both use direction ids 0 and 1, and
  some Purple trips short-loop rather than running the full line. Keying on
  direction alone merges them and advertises the wrong destination.

- **A trip's final stop is excluded.** GTFS gives terminating trains a departure
  time at their last stop, but you cannot board there.

- **The BMRCL parking page is Kannada-only**, despite living on the `english.`
  subdomain. Station names are matched through `scripts/parking-aliases.json`
  by exact string. Matching is deliberately not fuzzy: showing the wrong
  station's parking is worse than failing the build. If BMRCL renames a lot,
  the build fails and someone adds a line to that file.

- **MapLibre v6 needs its worker copied into `public/`.** Next emits neither the
  worker nor its shared sibling, and without them the map is a blank grey
  canvas. Handled by `scripts/copy-maplibre-worker.mjs` as a pre-build step.
  v6 also requires WebGL2 and throws `GPUInitializationError` without it, so the
  map degrades to a link rather than breaking the page.

- **The BMTC feed is never loaded whole.** It is ~44 MB zipped and 204 MB
  unpacked (`stop_times.txt` alone is 78 MB). `scripts/buses.ts` writes it to a
  temp file and streams it line by line, keeping only rows for the ~730 bus
  stops that are within 500 m of a metro station — about 318k of 1.54M rows.
  That runs in roughly two minutes; loading it into memory would not survive CI.

- **Bus timings are shown as frequency, not departures.** The BMTC feed is
  scraped from the Namma BMTC app and its per-trip times are known to be wrong.
  Trip counts across a day are still a fair frequency signal, so the UI says
  "every ~11 min, 04:23-23:04, 105 trips/day" rather than a precise next bus a
  rider would plan around. Routes prefixed `MF` are metro feeders and are
  highlighted, since those exist specifically to connect to the station.

- **Overpass wants one indexed query per tag, not one clever query.** A regex
  across tag values, or an `around:` over all 83 stations at once, forces a full
  scan and the server answers 504. Thirteen exact-match bounding-box queries with
  a pause between them finish in a couple of minutes. Overpass also 406s the
  default Node/curl User-Agent, and 429s rapid-fire requests.

- **The POI step is allowed to fail.** It runs last and is wrapped in a
  try/catch, because Overpass is the least reliable dependency here and must
  never cost a good GTFS build. `pois.json` is optional at read time too.

- **Geolocation is only ever requested from a button tap.** On iOS it must come
  from a user gesture, `navigator.permissions.query()` disagrees with Safari's
  real setting, and the grant is one-shot so a refresh re-prompts. The last fix
  is cached in `localStorage` to avoid prompting on every load.

## Data sources and licensing

- Timetables: [Vonter/bmrcl-gtfs](https://github.com/Vonter/bmrcl-gtfs) — **ODbL 1.0**,
  transcribed from BMRCL's published timetables. Intermediate stop times are
  interpolated and can differ by a minute or two.
- Parking: [BMRCL](https://english.bmrc.co.in/parking/) — official rates and
  per-station capacity.
- Buses: [Vonter/bmtc-gtfs](https://github.com/Vonter/bmtc-gtfs) — **ODbL 1.0**,
  scraped from the Namma BMTC app. Timetables are known-inaccurate; treated as
  frequency data only.
- Nearby places and map tiles: OpenStreetMap contributors via
  [Overpass](https://overpass-api.de/) and [OpenFreeMap](https://openfreemap.org/).

ODbL requires attribution and share-alike; the footer carries it on every page.

## Not built yet

Nothing planned. This is deliberately small.

## Design

The visual language comes from station signage rather than from a generic app
kit.

- **Barlow** for the interface — a grotesk drawn from public-signage lettering.
  **IBM Plex Mono** for every number: times, fares, distances, capacities. A
  departure board reads in monospace, and columns of digits line up honestly.
- The **line rail** down the left of each block is a fragment of the metro map,
  with a node marking this station. The colour is structural — it tells you
  which line and where you are — rather than a decorative bar on a card.
- Neutrals carry a faint violet bias rather than being pure grey, tuned to
  BMRCL's Purple. Semantic colours (short-loop warnings) stay separate from the
  accent.
- Flat planes divided by hairlines, not floating rounded cards. Signage is
  planar.
- The next departure time is the largest element on the page, because that is
  the thing you are squinting at.

Both themes are defined token-level on bare `:root`, with dark redefining only
the tokens — so the un-stamped "system" default resolves correctly rather than
rendering one theme's text on the other's ground.

## Why this isn't a business

Worth writing down, so nobody re-litigates it later.

Every competitor here is free, and the ones with revenue don't earn it from
commuters. Tummoc does almost exactly this for Bengaluru — 800k users, $5.33M
raised, still no consumer revenue. Chalo has raised $117M and earns from
ticketing commission and operator SaaS, not from timetables. BMRCL's own app has
3.4M downloads, is free, and can sell you a ticket, which this cannot.

There is no moat: the data is ODbL public data and this whole dataset was
rebuilt in an afternoon. Google Maps wins "nearby places" outright on reviews,
hours and photos. The money in transit is the ticket, and that flows through
BMRCL/ONDC.

The one thing genuinely absent everywhere is **parking** — and the real question
is occupancy ("will I find a space?"), which no public data answers. Capacity is
the closest available proxy, which is why it is given prominence here and
labelled honestly as capacity rather than availability.

---

Built by **[Saifulla Attar](https://www.linkedin.com/in/mdsaifullaattar)**.
