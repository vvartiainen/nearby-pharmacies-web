# ADR 0001: Finland coverage and straight-line ranking

Status: Accepted (2026-11-22). The 50 m duplicate and 5 km border-note thresholds were kept by the
importer.

## Context

The first release finds the nearest pharmacy from Helsinki Central Railway Station, the user's
location, a searched place or a dropped pin. It must work as a public demo with no reviewer keys,
give the same order on web and iOS, and be reproducible. OpenStreetMap has 786
`amenity=pharmacy` features in Finland (752 nodes, 31 ways, 3 relations), which normalize to
about 34 KB gzipped ([research](../research/finland-pharmacy-data.md)).

## Decision

1. **Coverage.** Bundle one Finland snapshot from a dated regional extract (Geofabrik
   `finland-latest.osm.pbf`), not a live API. Label results "nearest mapped pharmacies in
   Finland". When the origin is outside Finland or within about 5 km of a land border, show a
   short note that pharmacies in other countries are not included. Outside Finland, keep the
   origin and offer a return to Helsinki.
2. **Ranking.** Rank by great-circle distance with the haversine formula and one shared mean
   Earth radius. Sort by unrounded distance, then by stable OSM ID (`node/…`, `way/…`,
   `relation/…`, compared as strings) for exact ties. Round only for display, and call it a
   straight-line distance. No walking routes in this release.
3. **Areas.** Map ways and relations to one point at import. For distance, the bounding-box centre
   is acceptable. The importer should store an interior point (point-on-surface) so that pins
   land inside the outline.
4. **Duplicates.** Proposed importer rule: drop a feature that has no `name` and lies within 50 m
   of a named pharmacy, or inside its outline. Otherwise keep both, even when close: neighbouring
   pharmacies are real. Log each drop with both IDs and report same-name pairs within 1 km for
   manual review instead of merging them.

## Consequences

- No per-search cost, location disclosure or quota, and a reviewer gets identical results offline.
  Freshness depends on refreshing the snapshot.
- Near borders and in the far north the nearest listed pharmacy may not be the nearest real one.
  The disclosure note is the only mitigation in this release.
- Straight-line order can mislead across rivers. Walking-time ranking remains a documented
  follow-up (see the README).
- One in five rows will show "Hours unavailable", and unnamed features need a fallback or must be
  dropped.

## Evidence

- **Border:** from Haparanda station (`node/1798579162`, Sweden), Apoteket Aspen
  (`node/11503723824`, 1.14 km) and Kronans Apotek (`node/11503925607`, 1.41 km) are nearer than
  the nearest Finnish pharmacy, Tornion I Apteekki (`node/582471566`, 1.72 km). This is why the
  border note is part of the decision.
- **Rural:** from Utsjoki (`node/60070999`) the nearest Finnish result is 140.5 km away
  (`node/5062474709`, Ivalo), and a Norwegian one is 75.8 km away. The note also applies there.
- **Duplicate:** an unnamed `node/12976930478` sits 7.3 m from Apteekki CityCenter
  (`node/11771777459`) and would be the second result from the default origin without the rule.
  Apteekkiplus and Lentoaseman apteekki at Helsinki Airport, 34.5 m apart, are separate
  pharmacies. This is why the rule requires a missing name and not distance alone.
- **Areas:** across 31 ways the bbox centre is at most 5.8 m from the centroid
  (`way/621397347`), but it lies outside two L-shaped outlines.
- **Tie:** Yliopiston apteekki (`node/1369465698`) and Kluuvin apteekki (`node/4727972444`) are
  295.96 m and 296.05 m from the station and both display as 0.3 km. The order must come from the
  unrounded value.
