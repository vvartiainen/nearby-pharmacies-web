# Geocoding and web tiles: research

Research before choosing the geocoder and the web map tiles. Trials ran on 2026-11-22. The
decision is in [ADR 0002](../adr/0002-geocoder-and-web-tiles.md).

The defaults must be free, OpenStreetMap-based and keyless, and they must extend to other regions
later. Distance ranking happens on the device from the bundled OSM pharmacy snapshot. The online
geocoder receives the submitted search text, language, and country filter.

> **Nominatim usage policy.** The public instance at `nominatim.openstreetmap.org` runs on donated
> servers with very limited capacity. Its [usage policy][nom-policy] allows end-user-triggered
> searches for a moderate number of users and sets an absolute maximum of 1 request per second
> across all users of an app. It forbids autocomplete and systematic queries. It requires an
> identifying Referer or User-Agent, attribution and caching. Apps must be able to switch provider
> without a software update. The policy also asks that LLM-suggested use points to it and explains
> these limits, and that the developer makes a deliberate, informed decision to use it. The ADR
> therefore stays _Proposed_ until the user accepts it.

## Geocoder candidates

| Candidate                                 | Key      | Terms for this app                                                                                                                                            | Finland bias                                                                    | Language                                                                                       | Swedish names          | Typo tolerance | Other regions                    |
| ----------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------- | -------------- | -------------------------------- |
| Nominatim, OSMF public instance           | None     | Max 1 req/s total, identifying Referer or User-Agent, no autocomplete, cache results, switchable without an app update, ODbL attribution [policy][nom-policy] | `countrycodes=fi` filter; `viewbox` with optional `bounded=1` [API][nom-search] | `accept-language` parameter or header                                                          | Yes                    | None           | Worldwide; change `countrycodes` |
| Photon, komoot public instance            | None     | "Please be fair"; extensive use is throttled or banned; no stated limit or SLA [home][photon-home] [README][photon-readme]                                    | `countrycode=FI`, `bbox`, or `lat`/`lon` focus [API][photon-api]                | `lang`; public dumps hold local, English, German and French names only [README][photon-readme] | No                     | Yes            | Worldwide; change `countrycode`  |
| Digitransit (Finnish Pelias)              | Required | Registration and subscription key; rate and quota limits since 2024-01-31 [portal][digitransit-reg]                                                           | Finland only                                                                    | Pelias `lang`                                                                                  | Not tested             | Not tested     | Finland only                     |
| Bundled place index from the OSM importer | None     | ODbL notice already shipped with the snapshot                                                                                                                 | Built per extract                                                               | `name`, `name:fi`, `name:sv`, `name:en`                                                        | Yes, if `name:sv` kept | Local fuzzy    | One index per configured extract |

Digitransit without a key returned HTTP 401 `Access denied due to missing subscription key`, so it
is excluded. Its address search would add no coverage that Nominatim lacks for this app.

## Geocoder trial results

Samples with the fields the app would use are in [`geocoding/`](geocoding/), one file per query
with Nominatim and Photon results and the parameters used. The Finnish and English Nominatim requests
returned the same places, with country names localized to the requested language.

| Query                       | Nominatim                                                        | Photon                                                                 |
| --------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Tampere                     | City of Tampere only                                             | City first, then 4 POIs named Tampere                                  |
| Mannerheimintie 1, Helsinki | Erottajan Apteekki and the building at no. 1, Helsinki           | Music Centre (no. 13A) first, then no. 1                               |
| Hämeenkatu 1, Tampere       | 5 POIs and the building at no. 1                                 | Market Hall (no. 19) twice first, then no. 1                           |
| Kauppakatu 1                | Buildings at no. 1 in **Tampere, Lahti, Kuopio, Kotka, Joensuu** | **Streets only, no house number:** Jyväskylä ×3, Rauma, Kotka          |
| Koulukatu 5                 | Buildings at no. 5 in Oulu, Vaasa, Kotka, Joensuu, Mikkeli       | Buildings at no. 5 in Suomussalmi, Kotka, Imatra, Raahe, Kuhmo         |
| Helsingfors                 | City of Helsinki                                                 | 5 Helsinki POIs with "Helsingfors" in their names; no city             |
| Tammerfors                  | City of Tampere                                                  | Tako carton board mill (first run without `layer`: Tammerkoski rapids) |
| Åbo                         | City of Turku                                                    | Åbo Akademi, Åbo Svenska Teater, Åbovägen street in Raseborg           |
| Hämenkatu 1, Tampre (typos) | **No results**                                                   | City of Tampere, Market Hall (Hämeenkatu 19), stadium                  |

Latency per request was 0.36–1.49 s for Nominatim and 0.43–0.99 s for Photon in these trials.

What the trials show:

- **Ambiguous streets.** Nominatim lists buildings at Kauppakatu 1 in several municipalities.
  Photon returns street matches without house numbers for that query.
- **Swedish names.** Finland is officially bilingual. The public Photon instance does not index
  `name:sv`, so "Helsingfors", "Tammerfors" and "Åbo" do not find the cities. Nominatim does.
- **Full addresses.** Nominatim puts the requested address first. Photon ranked a more prominent
  POI on the same street first in both tests.
- **Typos.** Photon returned matches for the misspelt query. Nominatim returned none. The bundled
  place index can still fuzzy-match a misspelt city name.
- **Labels.** Each provider returns a municipality and a country for every Finnish address result
  (Nominatim `address.city`, `town`, `village` or `municipality`; Photon `city`, missing on the city
  result itself, where `name` is the city). Build the label from road, house number, municipality
  and country, not from the OSM `name`: one Nominatim result in Kotka has the Russian name
  "Котка парковка". Request results in the UI locale so the country reads "Suomi" or "Finland".

## Bundled place index

The same importer that builds the pharmacy snapshot from a Geofabrik extract can also emit a small
index of populated places. An Overpass count for Finland on 2026-11-22 found 510 `place=city` and
`town` nodes, 3,859 `place=village` nodes, 5,499 `suburb`, `quarter` and `neighbourhood` nodes and
308 municipalities (`admin_level=8`). Keeping name, `name:sv`, `name:en`, municipality and
coordinates for municipalities, cities, towns and villages gives about 4,700 entries. A rough
estimate is a few hundred kilobytes of JSON before compression. The size was not measured.

The index answers city searches offline and fuzzy-matches misspelt place names. It cannot resolve
street addresses. Each entry needs its municipality, which the importer derives by point-in-polygon
against the municipality boundaries in the extract. Adding a region adds another extract and its
index, the same way as the pharmacy snapshot.

## Web tile candidates

One tile per candidate was fetched at z14/9326/4742 (Kamppi and Töölö, Helsinki) with an
identifying User-Agent and Referer. The tiles were kept in `/tmp` only.

| Candidate                              | Key                                            | Result                                                               | Renderer                                                                                 | Max zoom                     | Caching seen                                    | Required attribution                                                                |
| -------------------------------------- | ---------------------------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ---------------------------- | ----------------------------------------------- | ----------------------------------------------------------------------------------- |
| OSM Standard, `tile.openstreetmap.org` | None                                           | 200, 256 px PNG, 42 KB, 0.42 s, CORS `*`                             | Leaflet `L.tileLayer`                                                                    | 19                           | `max-age` about 4.6 h, `stale-while-revalidate` | © OpenStreetMap contributors, linked to `openstreetmap.org/copyright`               |
| OpenFreeMap, `tiles.openfreemap.org`   | None                                           | Liberty style 200; vector tile 200, 415 KB, 0.96 s, Cloudflare       | MapLibre GL JS, or Leaflet with `@maplibre/maplibre-gl-leaflet` [quick start][ofm-quick] | 14, overzoomed by the client | `max-age=315360000`, immutable dated tileset    | OpenFreeMap © OpenMapTiles Data from OpenStreetMap; MapLibre adds it from the style |
| OSM vector, `vector.openstreetmap.org` | None                                           | TileJSON 200; Shortbread tile 200, 342 KB                            | MapLibre with a Shortbread style that we would have to supply                            | 14                           | `max-age=300`                                   | © OpenStreetMap                                                                     |
| CARTO basemaps                         | **Required since 2026-09-25** [FAQ][carto-faq] | 200, 2 KB PNG reading "API KEY REQUIRED · carto.com/basemaps/apikey" | Leaflet                                                                                  | —                            | —                                               | © OpenStreetMap contributors, © CARTO                                               |

Request rules:

- **OSM Standard** [tile policy][tile-policy]: use exactly `https://tile.openstreetmap.org/{z}/{x}/{y}.png`;
  send a valid Referer from web pages and do not set a restrictive `Referrer-Policy`; do not send
  no-cache headers; honour cache headers (browsers do); no prefetching, offline downloads or
  "headless bots that pan/zoom the map". Attribution must be visible on the map, not hidden behind a
  toggle. Recommended: no hard-coded URL, a "Report a map issue" link to
  `openstreetmap.org/fixthemap` and a published contact. Usage is best effort with no SLA.
- **OpenFreeMap** [home][ofm-home] [terms][ofm-tos]: free with no request limits, no registration
  and commercial use allowed. Offline downloads up to 3,000 tiles or 50 MB per download. No SLA, and
  the service may be discontinued without notice. One operator in Hungary funds it from donations.
- **OSM vector** [policy][osm-vector]: the same identification and caching rules as OSM Standard,
  and no bulk downloading. OSMF offers no ready-made style for it.

## What each service receives

| Service                       | Receives                                                                | Logging and retention                                                                                                                                                     | Hosting                                         |
| ----------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Nominatim (OSMF)              | Search text, IP, User-Agent, Referer (the page origin), Accept-Language | IP, browser, referring page and time are recorded; queries may be analysed for missing addresses; no general retention period stated [OSMF privacy][osmf-privacy]         | UK and the Netherlands; backups in the EU       |
| Photon (komoot)               | Search text, IP, User-Agent, Referer                                    | No Photon-specific policy. komoot's policy stores IP addresses for 90 days [komoot privacy][komoot-privacy]                                                               | Not stated for Photon                           |
| OSM Standard and vector tiles | Viewport tiles (approximate area and zoom), IP, User-Agent, Referer     | As Nominatim; anonymised aggregate tile statistics are published                                                                                                          | Global CDN; the cache server depends on the CDN |
| OpenFreeMap                   | Viewport tiles, IP, User-Agent, Referer                                 | No IPs in access logs; error logs with IP and URL kept 7 days; IP logging up to 30 days during incidents [privacy][ofm-privacy]                                           | Dedicated servers; may use Cloudflare           |
| Apple MapKit (iOS map)        | Map viewport                                                            | Usage tied to an identifier that rotates several times an hour, not to the Apple Account; precise locations made less exact within 24 hours [Maps privacy][apple-privacy] | Apple                                           |

None of these services receives the device location or the chosen origin coordinates from this
app, because ranking is local. The map viewport still reveals the area being viewed.

## Failure behaviour

- **Geocoder unavailable, rate-limited (HTTP 429), or timed out.** Show "Address search is not
  available right now" next to the field, keep the active origin and list, and offer the bundled
  place index for city names. Pin drop and device location keep working because they do not use the
  geocoder. Do not retry automatically: Nominatim treats repeated identical queries as faulty clients.
- **Zero results.** Show "No matches" with the submitted text and a spelling hint, then offer place
  index matches for the city part. This covers Nominatim's lack of typo tolerance for city names.
- **Late responses.** Ignore a geocoder response that arrives after the user has dropped a pin or
  started another search, as the plan's race example requires.
- **Tiles unavailable.** Leaflet shows grey tiles; the result list, origin label, distances and
  details keep working. Keep the attribution visible. Playwright tests must stub tile requests: the
  OSM policy bans automated panning and bulk fetching, and stubs keep screenshots stable.

## Extending to more regions

The online geocoders are worldwide: a region is a configuration change, for example
`countrycodes=fi,se` and a matching default viewbox. OSM Standard tiles and OpenFreeMap are
worldwide. The pharmacy snapshot and the bundled place index are per extract, so each new region
adds a Geofabrik extract to the importer configuration and ships its snapshot and place index.

## Sources

[nom-policy]: https://operations.osmfoundation.org/policies/nominatim/
[nom-search]: https://nominatim.org/release-docs/latest/api/Search/
[photon-home]: https://photon.komoot.io/
[photon-readme]: https://github.com/komoot/photon/blob/master/README.md
[photon-api]: https://github.com/komoot/photon/blob/master/docs/api-v1.md
[digitransit-reg]: https://digitransit.fi/en/developers/api-registration/
[tile-policy]: https://operations.osmfoundation.org/policies/tiles/
[osm-vector]: https://operations.osmfoundation.org/policies/vector/
[ofm-home]: https://openfreemap.org/
[ofm-quick]: https://openfreemap.org/quick_start/
[ofm-tos]: https://openfreemap.org/tos/
[ofm-privacy]: https://openfreemap.org/privacy/
[carto-faq]: https://carto.com/basemaps/faq
[osmf-privacy]: https://osmfoundation.org/wiki/Privacy_Policy
[komoot-privacy]: https://www.komoot.com/privacy
[apple-privacy]: https://www.apple.com/legal/privacy/data/en/apple-maps/

- OSM attribution guidelines: <https://osmfoundation.org/wiki/Licence/Attribution_Guidelines>
