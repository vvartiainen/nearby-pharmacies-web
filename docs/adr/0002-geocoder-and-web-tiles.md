# ADR 0002: Geocoder and web tiles

Status: Accepted (2026-11-22). The project owner accepted the public Nominatim
[usage policy](https://operations.osmfoundation.org/policies/nominatim/) for the demo after
comparing Photon, a self-hosted instance, bundled addresses and Digitransit. A
self-hosted Nominatim or Photon is the upgrade path if traffic grows.

## Context

Origin search takes a submitted "City or street address" query, lists matches with municipality
and country, and biases results to Finland. Ranking runs on the device against the bundled OSM
pharmacy snapshot, so the geocoder only receives the search text. The defaults must be free,
OSM-based and keyless, the public demo must run without keys, and other regions must be easy to add.
Geoapify may only be an optional alternative. Evidence is in
[the research note](../research/geocoding-and-tiles.md).

## Decision

1. **Geocoder: public Nominatim on web and iOS**, called from the client behind a `Geocoder`
   interface. Parameters: `countrycodes=fi`, `addressdetails=1`, `limit=5`, `accept-language` from
   the UI locale. Labels come from road, house number, municipality (`city`, `town`, `village` or
   `municipality`) and country.
2. **Rate-limit compliance.** One request per submitted search, no autocomplete, no automatic
   retries, at most one request in flight, and a session cache keyed by normalized query and
   language. The browser sends the page Referer; do not set a restrictive `Referrer-Policy`. iOS
   sends `User-Agent: NearbyPharmacies/<version> (<repo URL>)`. Show "Search © OpenStreetMap
   contributors" next to the results.
3. **Switchable without an app update.** The provider, endpoint and region filter come from a small
   static `geocoder.json` served with the web demo. iOS fetches it at launch and falls back to the
   copy in the app. Supported providers: `nominatim` (default, any instance URL), `photon` (keyless
   alternative) and `geoapify`.
4. **Bundled place index.** The OSM importer also emits municipalities, cities, towns and villages
   (about 4,700 entries for Finland) with `name:sv`, municipality and coordinates. It answers city
   searches when the geocoder fails, times out, is rate-limited or returns nothing, with local fuzzy
   matching. Street addresses still need the online geocoder. Pin drop and device location never
   depend on either.
5. **iOS basemap.** MapKit draws the iOS map.
6. **Web map: Leaflet with OSM Standard raster tiles** from `https://tile.openstreetmap.org/{z}/{x}/{y}.png`,
   max zoom 19, attribution "© OpenStreetMap contributors" linked to `openstreetmap.org/copyright`,
   plus a "Report a map issue" link. The tile URL, attribution and max zoom are build-time settings,
   so a switch needs only a redeploy. The keyless fallback is OpenFreeMap, which also needs
   `maplibre-gl` and `@maplibre/maplibre-gl-leaflet`. CARTO is excluded: its tiles need a key since
   2026-09-25.
7. **Optional Geoapify.** Enabled only when a build sets `VITE_GEOCODER_PROVIDER=geoapify` and
   `VITE_GEOAPIFY_KEY`; tiles use the same key through the tile settings. Restrict the key to the
   deployed origins in Geoapify MyProjects, use a separate key per environment, never commit it,
   and add "Powered by Geoapify". The public demo build does not set it.

## Consequences

- The demo depends on donated OSMF capacity with no SLA. A busy deployment must move to its own
  Nominatim or Photon instance or Geoapify, which is a configuration change.
- Nominatim has no typo tolerance, so "No matches" with a spelling hint is a normal outcome.
- Web and iOS return the same matches for the same query and share the geocoder fixtures.
- Playwright and XCUITest stub geocoder and tile requests. The OSM tile policy bans automated
  panning, and the live landmark check stays a separate manual smoke test.
- Privacy: OSMF receives the search text, IP address and Referer or User-Agent, and the tile servers
  receive the viewport. The origin coordinates never leave the device. Tell users this at the search
  field and keep queries out of logs, URLs and analytics.
- More regions: widen `countrycodes` in `geocoder.json` and add a Geofabrik extract, which yields
  another pharmacy snapshot and place index. The tile sources are already worldwide.

## Evidence

Trials on 2026-11-22, saved in [`docs/research/geocoding/`](../research/geocoding/):

- [`kauppakatu1.json`](../research/geocoding/kauppakatu1.json): Nominatim returned the building at
  no. 1 in Tampere, Lahti, Kuopio, Kotka and Joensuu, which fits the pick-a-municipality design.
  Photon returned street matches without house numbers.
- [`helsingfors.json`](../research/geocoding/helsingfors.json), `tammerfors.json` and `abo.json`:
  public Photon does not index Swedish names, while Nominatim found all three cities.
- [`misspelt.json`](../research/geocoding/misspelt.json): Nominatim returned no results, which
  motivated the place-index fallback.
- A CARTO tile requested without a key returned "API KEY REQUIRED"; OSM Standard and OpenFreeMap
  tiles loaded keyless.
