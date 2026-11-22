# Pharmacy research samples

Small normalized extracts of OpenStreetMap `amenity=pharmacy` features for design work and test
fixtures. They are research samples, not the release snapshot: task 5 builds that from a regional
extract.

© OpenStreetMap contributors, data available under the Open Database License (ODbL).
<https://www.openstreetmap.org/copyright>

## Files

| File                           | Content                                                                               |
| ------------------------------ | ------------------------------------------------------------------------------------- |
| `helsinki-central.json`        | Nearest 6 from Helsinki Central Railway Station, the default origin                   |
| `utsjoki-rural.json`           | Nearest 5 Finnish pharmacies from Utsjoki, plus a nearer one in Norway (out of scope) |
| `tornio-haparanda-border.json` | Tornio origin, plus a Haparanda origin where Swedish pharmacies are nearer            |
| `edge-cases.json`              | Long names, missing fields, areas, duplicate pairs, odd hours and a near tie          |

## Record shape

Each pharmacy record has `id` (`node/123`, `way/123` or `relation/123`), `name` (`null` when the
feature has no name), `lat`, `lon`, optional `address` (`street`, `housenumber`, `postcode`,
`city`), optional `openingHours` (the raw OSM `opening_hours` string), `country` (`FI` for
features returned by the Finland area query), `source` and an optional `note`. Ways and relations
use the Overpass bounding-box centre. Area files add `straightLineKm` from the origin: haversine
with mean Earth radius 6371.0088 km, rounded to 4 decimals in these files only. Task 5 agrees on
the final constant and the display rounding.

## Retrieval

All queries went to `https://overpass-api.de/api/interpreter` with the User-Agent
`nearby-pharmacies-research/0.1` on 2026-11-22. The query files are in `../queries/`.

| Query                                    | Retrieved (UTC)      | OSM data timestamp   | Used for                          |
| ---------------------------------------- | -------------------- | -------------------- | --------------------------------- |
| `finland-pharmacies.overpassql`          | 2026-11-22T13:06:25Z | 2026-11-22T13:04:20Z | All Finnish records, statistics   |
| `finland-pharmacy-areas-geom.overpassql` | 2026-11-22T13:07:42Z | 2026-11-22           | Way outlines, centroid check      |
| `landmarks.overpassql`                   | 2026-11-22T13:08:20Z | 2026-11-22T13:07:21Z | Origin coordinates                |
| `border-tornio-haparanda.overpassql`     | 2026-11-22T13:08:53Z | 2026-11-22T13:07:21Z | Swedish pharmacies near Tornio    |
| `sample-utsjoki-region.overpassql`       | 2026-11-22T13:12:53Z | 2026-11-22T13:11:21Z | Norwegian pharmacies near Utsjoki |

Reproduce one with:

```sh
curl -sS -A "nearby-pharmacies-research/0.1" \
  --data-urlencode data@docs/research/queries/finland-pharmacies.overpassql \
  https://overpass-api.de/api/interpreter -o /tmp/task3a/finland.json
```

Results will drift as OSM is edited. The raw responses were kept outside the repository in
`/tmp/task3a/`.
