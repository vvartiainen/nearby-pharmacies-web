# Finland pharmacy data in OpenStreetMap

Research for task 3: how complete and how clean `amenity=pharmacy` data is in Finland, and what
the nearest results look like from three public landmarks. Data was retrieved from the public
Overpass API on 2026-11-22 (OSM data timestamp 2026-11-22T13:04:20Z). Queries are in
[`queries/`](queries/), normalized samples in [`samples/`](samples/).

© OpenStreetMap contributors, data available under the Open Database License (ODbL).

## Summary

- 786 features: 752 nodes, 31 ways, 3 relations. The Finland boundary area includes Åland.
- Names are almost complete (97.3%), full addresses 88.8%, opening hours 79.3%. One in five rows
  will show "Hours unavailable".
- A normalized snapshot is about 168 KB of minified JSON, 34 KB gzipped. It is small enough to
  bundle in both apps.
- Duplicates are rare: 3 likely duplicate pairs and 1 stale same-name pair out of 786 features.
- The Overpass bounding-box centre is within 6 m of the polygon centroid for every way.
- Coverage is very uneven. The nearest Finnish pharmacy is 50 m from Helsinki Central Railway
  Station but 140.5 km from Utsjoki. A Norwegian pharmacy is 76 km from Utsjoki.
- From a point on the Swedish side of Tornio–Haparanda, two Swedish pharmacies are nearer than
  any Finnish one.

## Field completeness

| Tag                                                   |     Features |               Share |
| ----------------------------------------------------- | -----------: | ------------------: |
| `name`                                                |          765 |               97.3% |
| `addr:street` + `addr:housenumber`                    |          720 |               91.6% |
| `addr:postcode`                                       |          707 |               89.9% |
| `addr:city`                                           |          703 |               89.4% |
| All four address parts                                |          698 |               88.8% |
| `opening_hours`                                       |          623 |               79.3% |
| `healthcare=pharmacy`                                 |          779 |               99.1% |
| `website`                                             |          699 |               88.9% |
| `phone`                                               |          695 |               88.4% |
| `dispensing` (405 `yes`, 11 `no`)                     |          416 |               52.9% |
| `email`                                               |          302 |               38.4% |
| `name:fi` / `name:sv` / `name:en`                     | 249 / 49 / 8 | 31.7% / 6.2% / 1.0% |
| `wheelchair` (142 yes, 11 limited, 2 no)              |          155 |               19.7% |
| `operator`                                            |          112 |               14.2% |
| `level`                                               |           91 |               11.6% |
| `brand` (mostly Avainapteekit, Hyvän Mielen Apteekki) |           39 |                5.0% |

The 21 unnamed features include 20 nodes and one building way (`way/34586704`, Siilinjärvi). Most
have only `amenity`, `healthcare` and sometimes `dispensing`.

**Worth keeping in the snapshot:** `name`, the four address parts, `opening_hours`, `website`,
`phone` and `wheelchair`, plus `name:fi` and `name:sv` for bilingual places. `dispensing=no`
(11 features) marks outlets that do not dispense prescriptions and could be shown as a note.
`level` helps inside shopping centres. Brand coverage is too sparse to use.

## Opening hours

623 features have `opening_hours`, with 327 distinct values. A loose check against the simple form
`Mo-Fr 09:00-18:00; Sa 10:00-14:00` flagged 33 values. Most of those are valid but richer syntax:

- comma-separated rule lists, for example `Mo-Fr 09:00-19:00, Sa 09:00-15:00` (about 15);
- alternating weeks, for example `week 01-53/2 Mo-Fr 09:00-19:00; week 02-52/2 …` on
  `node/298107287`;
- seasonal months, for example `Aug-Jun Mo-Fr 09:30-17:00; Jul Mo-Th 09:00-12:30`;
- no weekday at all: `08:00-24:00` on `node/1369465698`, Yliopiston apteekki near the station;
- dates: `Jun 21,Dec 24 09:00-12:00`.

3 values are suspicious: they use `||` fallback rules with free-text comments
(`"Between the 1st and 16th of every month"` in Mariehamn, `"parillisina viikkoina"` on
`node/4724090790`, Kuusamo). `node/249355455` combines an Alko liquor store and a pharmacy in one
node, so its hours mix two shops. 26 values mention public holidays (`PH`) and one is `24/7`.

The release should show the raw schedule, or a parsed weekly view where a parser accepts it,
without an "open now" badge. A parser such as `opening_hours.js` needs a fallback to the raw text.

## Snapshot size

A normalized Finland snapshot with `id`, `name`, `lat`, `lon`, address parts and raw
`openingHours`, sorted by ID:

| Format             |    Raw | gzip -9 |
| ------------------ | -----: | ------: |
| Minified JSON      | 168 KB |   34 KB |
| Two-space indented | 226 KB |   36 KB |

Adding `website`, `phone` and `wheelchair` would add roughly 60 KB raw.

## Duplicate representations

A pairwise check found 15 pairs within 100 m and 6 within 50 m. Most are separate pharmacies in
the same shopping centre or street. Likely duplicates:

| Pair                                                                                           | Gap   | Assessment                                     |
| ---------------------------------------------------------------------------------------------- | ----- | ---------------------------------------------- |
| `node/11771777459` Apteekki CityCenter + `node/12976930478` unnamed, both `level=-1`, Helsinki | 7.3 m | Duplicate; the unnamed node has no other tags  |
| `node/249355455` "Alko;Graanin Apteekki" + `node/13959444245` unnamed, Mikkeli                 | 33 m  | Probably the pharmacy split from the Alko node |
| `way/402056943` Kuusankosken Ykkösapteekki + `node/1745196792` unnamed                         | 77 m  | Likely stale node                              |
| `node/285492535` + `node/14110808433`, both "Järvenpään Lähiapteekki"                          | 635 m | One complete, one name-only; possibly a move   |

Not duplicates despite being close: `way/1375681869` Apteekkiplus and `relation/20401883`
Lentoaseman apteekki at Helsinki Airport (34.5 m, different operators), and the 32 m pair in
Jyväskylä (Yliopiston Apteekki and Jyväskylän Uusi Apteekki). No pharmacy node lies inside a
pharmacy way, so the classic node-inside-building duplicate does not occur in this data.

A distance rule alone would merge real neighbours. A safe importer rule needs both proximity and
a missing or matching name (see the ADR).

## Area representative coordinate

For the 31 ways, the Overpass `center` (bounding-box centre) was compared with the planar polygon
centroid. The largest gap is 5.8 m (`way/621397347`, Enonkosken sivuapteekki). For two L-shaped
outlines, that one and `way/1011337574` (Matinkylän apteekki, 3.7 m), the bbox centre falls just
outside the polygon while the centroid is inside. All 31 are single rooms or small buildings with
outlines under 1,000 m², so the error is far below the 0.1 km display precision.

The three relations (`relation/18743577` Zeppelinin apteekki, `relation/20011186` Ritaharjun
apteekki, `relation/20401883` Lentoaseman apteekki) are rooms inside shopping centres or the
airport. Their outlines were not retrieved: the query used `out geom tags`, which leaves out
relation members, and a corrected re-fetch hit public Overpass capacity limits, so it was
abandoned. Their bboxes are small, but the centroid check for them is left to the task 5
importer.

The bbox centre is good enough for distance. A map pin is better placed with a point-on-surface
or an interior point, which the importer can compute from full geometry.

## Sample areas

Distances are haversine with mean Earth radius 6371.0088 km. Task 5 fixes the final constant and
rounding.

### Helsinki Central Railway Station (default origin)

Origin `node/25474663`, `railway=station`, name Helsinki, 60.1720965, 24.9412486.

| #   | ID                 | Name                |  Distance | Address | Hours               |
| --- | ------------------ | ------------------- | --------: | ------- | ------------------- |
| 1   | `node/1369465553`  | Steissin Apteekki   | 0.0504 km | yes     | yes                 |
| 2   | `node/12976930478` | (unnamed duplicate) | 0.2269 km | no      | no                  |
| 3   | `node/11771777459` | Apteekki CityCenter | 0.2339 km | no      | yes                 |
| 4   | `node/1369465698`  | Yliopiston apteekki | 0.2960 km | yes     | yes (`08:00-24:00`) |
| 5   | `node/4727972444`  | Kluuvin apteekki    | 0.2961 km | yes     | yes                 |
| 6   | `node/6049453002`  | Erottajan Apteekki  | 0.4552 km | yes     | yes                 |

Rows 4 and 5 differ by 0.1 m (295.96 m and 296.05 m), so both display as 0.3 km. This is the
near tie that the ranking fixture needs. Without de-duplication, row 2 would be an unnamed
result in the default view.

### Utsjoki (sparse rural coverage)

Origin `node/60070999`, `place=town`, Utsjoki, 69.907601, 27.0252458.

| #   | ID                 | Name                    |    Distance | Address | Hours |
| --- | ------------------ | ----------------------- | ----------: | ------- | ----- |
| 1   | `node/5062474709`  | Ivalon apteekki         | 140.5346 km | yes     | yes   |
| 2   | `node/1512767497`  | Enontekiön sivuapteekki | 215.9566 km | yes     | yes   |
| 3   | `node/355703801`   | Levin apteekki          | 250.1273 km | yes     | yes   |
| 4   | `node/10712398188` | Muonion Apteekki        | 254.7471 km | yes     | yes   |
| 5   | `node/1327867422`  | Sodankylän Apteekki     | 277.4160 km | yes     | yes   |

The nearest pharmacy in OSM overall is `node/2352922035`, Apotek Sapmi in Karasjok, Norway, at
75.8 km. The UI needs to show three-digit kilometre distances and should say that results cover
Finland only.

### Tornio–Haparanda border

Origins: `node/30969802` (`place=town`, Tornio, 65.8457589, 24.1464) and `node/1798579162`
(Haparanda railway station in Sweden, 65.8281312, 24.1308946).

From Tornio:

| #   | ID                 | Name                | Country |   Distance |
| --- | ------------------ | ------------------- | ------- | ---------: |
| 1   | `node/582471566`   | Tornion I Apteekki  | FI      |  0.3683 km |
| –   | `node/11503925607` | Kronans Apotek      | SE      |  0.8251 km |
| –   | `node/11503723824` | Apoteket Aspen      | SE      |  0.9937 km |
| 2   | `way/49628851`     | Alatornion apteekki | FI      |  1.9774 km |
| 3   | `node/279248233`   | Keminmaan apteekki  | FI      | 18.1807 km |

From Haparanda station, Apoteket Aspen (1.1386 km) and Kronans Apotek (1.4054 km) are both nearer
than the nearest Finnish result, Tornion I Apteekki (1.7150 km). A Finland-only app would list the
Finnish one first without saying that nearer pharmacies exist across the border. From Tornio town
centre, the nearest result is Finnish either way. Two Swedish pharmacies would come before the
second Finnish one.

Not checked: whether some origin inside Finland, such as southern Suensaari, has a Swedish
pharmacy nearer than the nearest Finnish one. Distances suggest it is possible within a few
hundred metres of the river. The check needs the national border geometry. The public Overpass
servers were at capacity, so it was left for the importer's local extract.

## Design notes

- Long names: `Vaara-Karjalan apteekki (Heinävaaran palvelupiste)` (50 characters, no hours),
  `Konneveden apteekki, Sumiaisten palvelupiste` (44) and
  `Rotuaarin apteekin palvelupiste (airside)` (41). Rows must wrap to at least two lines.
- Names are Finnish compound words, often with `sivuapteekki` or `palvelupiste` (service point),
  so a row may need to break long words. Åland and bilingual towns use Swedish names
  (`Nagu Apotek`, `Första Apoteket`).
- 21 unnamed features need a fallback label, or the importer should drop them (see the ADR).
- About 1 in 9 rows lacks an address and 1 in 5 lacks hours.

## Surprises and limitations

- The public Overpass API returned 502 and 504 errors for about half of the attempts on this
  day. Task 5 should build from a downloaded Geofabrik extract (`finland-latest.osm.pbf`, 742 MB on
  2026-11-22) with a local tool such as osmium, not from Overpass.
- The `ISO3166-1=FI` area includes Åland. This is fine for coverage, but its hours and names are
  Swedish.
- Duplicate detection was a heuristic pass, not a full audit.
- The opening-hours check is a regular expression, not a parser.
