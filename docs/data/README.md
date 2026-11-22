# Bundled pharmacy data

The web and iOS apps bundle the same OpenStreetMap snapshot. The importer lives in
`scripts/data/` and writes its output to `src/data/`. Decisions behind it are in
[ADR 0001](../adr/0001-finland-coverage-and-straight-line-ranking.md) (ranking, areas,
duplicates) and [ADR 0002](../adr/0002-geocoder-and-web-tiles.md) (place index).

## Files

| File                          | Content                                                                                        |
| ----------------------------- | ---------------------------------------------------------------------------------------------- |
| `src/data/pharmacies.fi.json` | Pharmacy snapshot: `{"schemaVersion":1,"region":"fi","pharmacies":[...]}`                      |
| `src/data/places.fi.json`     | Place index (PBF import only): `{"schemaVersion":1,"region":"fi","places":[...]}`              |
| `src/data/coverage.fi.json`   | Simplified national boundary and land border for coverage notices (boundary-filtered PBF only) |
| `src/data/manifest.fi.json`   | Source, checksums, counts, dropped duplicates and review list                                  |
| `src/data/ODbL-NOTICE.txt`    | Licence notice to ship with the data                                                           |
| `src/data/schema.ts`          | TypeScript types for the files above                                                           |
| `src/data/index.ts`           | Typed import of the snapshot and manifest for the app                                          |
| `fixtures/ranking/`           | Shared ranking fixture and the independent Python check                                        |

The JSON data files are generated. Do not edit them by hand. They are excluded from Oxfmt and from
`pnpm run style`.

### Pharmacy record

`id` (`node/123`, `way/123` or `relation/123`), optional `name`, `lat` and `lon`, optional `pin`
`{lat, lon}`, optional `address` `{street, housenumber, postcode, city}`, optional raw
`openingHours`, and optional `dispensing`, `phone`, `website` and `wheelchair`. Absent values are
omitted, never `null`. Nodes use their own coordinate. Ways and relations use the bounding-box
centre for distance. Their `pin` is an interior point (pole of inaccessibility, from `polylabel`)
inside the outline, for the map marker. `street` falls back to `addr:place`. `phone` and `website`
fall back to `contact:phone` and `contact:website`.

### Place record

`id`, `name`, optional `nameSv` (only when it differs from `name`), `type` (`municipality`, `city`,
`town` or `village`), `lat`, `lon`, and optional `municipality`. Each municipality comes from an
`admin_level=8` boundary relation. Its point is the relation's `admin_centre` or `label` node, or
an interior point of its outline. Cities, towns and villages come from `place=*` nodes. Each gets
the name of the municipality boundary that contains it. Places mapped only as areas are not
included.

### Address index

`public/address-index/` contains 166 regional gzip shards derived from the same Finland OSM
extract as the pharmacy snapshot. It holds address-tagged nodes and ways with a street or place
name and house number. Way coordinates use the bounding-box centre. Both apps read only the
shards near a usable device fix or a point chosen on the map and display the closest mapped
address within 120 m. The point remains the input to pharmacy ranking. The files are generated and covered by the same
ODbL attribution as the snapshot.

Regenerate the address index from the repository root with:

```sh
pnpm run data:addresses ../finland-latest.osm.pbf
```

The command also accepts a second argument for an output directory. The index is not in the
snapshot manifest; `data:sync-ios` copies the whole folder to the iOS app.

## Importer

```sh
pnpm run data:import -- --input <extract.osm.pbf> --region fi
pnpm run data:import -- --overpass <response.json> --region fi
```

Options: `--out-dir` (default `src/data`), `--source-url` (recorded in the manifest; default for
`fi` is the Geofabrik URL), `--region-filter boundary|extract` (default `boundary`) and
`--municipality-admin-level` (default `8`). The scripts run TypeScript directly, which needs
Node 22.18+, 24 or 26.

The PBF reader is pure JavaScript: `pbf` decodes the protobuf messages and `node:zlib` inflates the
blobs. It needs no system tools. It reads the file in three passes and keeps only the selected
features and their geometry in memory:

1. relations (pharmacy areas, the country boundary, municipality boundaries) and tagged nodes;
2. pharmacy ways and the member ways found in pass 1;
3. coordinates of exactly the nodes those ways use, held in sorted typed arrays.

**Region.** With `--region-filter boundary`, the importer keeps only pharmacies and places inside
the `boundary=administrative`, `admin_level=2` relation with `ISO3166-1` equal to `--region`.
Geofabrik cuts its extracts with a buffer, so the Finland file also contains Swedish pharmacies in
Haparanda. Filtering on the extract alone would show them as Finnish results. If the boundary is
missing, the import fails. Excluded IDs are listed in the manifest's `outsideRegion`. The same
import generates the coverage file with closed boundary rings and non-maritime border
segments. It simplifies their geometry to a tolerance of 0.001° and writes coordinates with
five decimals. Ranking still uses the pharmacy coordinates and the importer filters against the
full boundary.

**Duplicates (ADR 0001).** A feature without a `name` is dropped when it lies within 50 m of a
named pharmacy, or inside a named pharmacy's outline. Each drop is logged and recorded in
`droppedDuplicates` together with the kept ID, the reason and the distance. Same-name pairs within
1 km stay in the snapshot and are listed in `sameNamePairs` for manual review.

**Output order.** Records are sorted by `id` in UTF-16 code-unit order. Each list file has one
compact record per line, so a changed pharmacy shows up as a one-line diff.

## Reproducibility

The same input file produces byte-identical output. The importer writes no wall-clock time. The
manifest's `generatedAt` is `SOURCE_DATE_EPOCH` when that is set. Otherwise it is the source data
timestamp: the PBF header's `osmosis_replication_timestamp`, or the Overpass `timestamp_osm_base`.
The manifest records the source file's name, size and SHA-256, and the SHA-256 of each shared
output file. The coverage file is derived from that same extract. Bump
`IMPORTER_VERSION` in `scripts/data/output.ts` whenever a shared output changes for the same input.

## Current snapshot

The checked-in data is a PBF import of Geofabrik's `finland-latest.osm.pbf` (OSM data
2026-11-21T21:20:51Z, replication sequence 4978): 784 pharmacies after dropping 2 unnamed
duplicates and 2 features outside Finland, and 4,675 places. The manifest has `"kind": "osm-pbf"`.
An Overpass response can still produce an interim snapshot (`--overpass`, `"kind":
"overpass-interim"`) without interior pins, a place index, or coverage geometry. Refresh the data with:

```sh
curl -L -o /tmp/finland-latest.osm.pbf https://download.geofabrik.de/europe/finland-latest.osm.pbf  # about 742 MB
pnpm run data:import -- --input /tmp/finland-latest.osm.pbf --region fi
```

## iOS copies

```sh
pnpm run data:sync-ios -- --ios-repo ../nearby-pharmacies-ios
pnpm run data:verify -- --ios-repo ../nearby-pharmacies-ios
```

The sync copies every file the manifest lists, plus the manifest itself, into
`NearbyPharmacies/Resources/Data/` (the app target). It copies `fixtures/ranking/ranking-v1.json`
to `NearbyPharmaciesTests/Fixtures/` (the unit-test target), and `public/address-index/` to
`NearbyPharmacies/Resources/AddressIndex.bundle/`, which Xcode copies into the app as one folder. Both folders sit inside Xcode
synchronized groups, so the files join their targets without project edits. File names are
unique, because Xcode flattens resources into one bundle folder. The sync refuses to copy when the
web files do not match their manifest. Verify exits 1 when any copy is missing or its SHA-256
differs.

## Ranking fixture

`fixtures/ranking/ranking-v1.json` records the contract: haversine with mean Earth radius
6371.0088 km, ascending unrounded distance, exact ties by `id` in code-unit order, and display
rounding. It defines 12 pharmacies, 3 origins with the full expected order, distances and en/fi
labels, and 19 display-rounding cases. The expected values come from
`fixtures/ranking/compute_expected.py`, which uses only the Python standard library and was written
separately from the TypeScript code. `pnpm run data:check-fixture` re-checks them. The Vitest suite
`src/ranking/rank.test.ts` checks the TypeScript code against the fixture. The iOS Swift Testing
suite should check against the same file.

## Licence

The data is © OpenStreetMap contributors and is available under the Open Database License (ODbL)
1.0. The snapshot, place index and coverage geometry are derived from OSM and published under
the ODbL.
`ODbL-NOTICE.txt` ships with both apps, and both apps show the attribution.
