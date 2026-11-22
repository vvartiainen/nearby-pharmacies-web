// Three streaming passes over an OSM PBF extract, keeping only what the snapshot needs:
//   1. relations (pharmacy areas, the country boundary, municipality boundaries) and tagged nodes
//      (pharmacies, places);
//   2. ways: pharmacy ways plus the member ways found in pass 1;
//   3. node coordinates for exactly the way nodes found in pass 2.
// Memory is bounded by the selected features and their geometry, not by the extract size.

import type { CoverageGeometry, Place, PlaceType } from "../../src/data/schema.ts";
import type { LatLon } from "../../src/shared/geo/haversine.ts";
import { compareIds } from "../../src/features/pharmacies/rank.ts";
import {
  assembleRings,
  bboxCentre,
  bboxOf,
  interiorPoint,
  pointInArea,
  roundCoordinate,
  simplifyBoundary,
  type BBox,
  type Position,
  type Ring,
} from "./geometry.ts";
import { NodeStore } from "./node-store.ts";
import type { RawFeature } from "./normalize.ts";
import { readPbf, type PbfHeader, type RelationMember, type Tags } from "./osm-pbf.ts";

export const PLACE_TYPES: readonly PlaceType[] = ["city", "town", "village"];

export interface PbfImportOptions {
  /** ISO 3166-1 alpha-2 code of the admin_level=2 boundary to restrict to, e.g. "fi". */
  region: string;
  /** "boundary" keeps features inside the country boundary; "extract" keeps the whole extract. */
  regionFilter: "boundary" | "extract";
  /** admin_level of municipalities for the place index (8 in Finland). */
  municipalityAdminLevel: string;
  log?: (message: string) => void;
}

export interface PbfImportResult {
  header: PbfHeader;
  features: RawFeature[];
  places: Place[];
  boundaryId?: string;
  coverage?: CoverageGeometry;
  outsideRegion: string[];
  municipalitiesWithoutGeometry: number;
  warnings: string[];
}

interface PendingRelation {
  id: number;
  tags: Tags;
  members: RelationMember[];
}

const nanoToDegrees = (nano: number) => roundCoordinate(nano / 1e9);
const isPharmacy = (tags: Tags | undefined) => tags?.amenity === "pharmacy";

export function importPbf(path: string, options: PbfImportOptions): PbfImportResult {
  const log = options.log ?? (() => {});
  const region = options.region.toUpperCase();
  const warnings: string[] = [];
  let header: PbfHeader = { requiredFeatures: [], optionalFeatures: [] };

  // Pass 1: relations and tagged nodes.
  const pharmacyNodes: RawFeature[] = [];
  const placeNodes = new Map<number, { tags: Tags; point: LatLon }>();
  const pharmacyRelations: PendingRelation[] = [];
  const municipalities: PendingRelation[] = [];
  let country: PendingRelation | undefined;
  readPbf(path, {
    tagKeys: new Set(["amenity", "place", "boundary"]),
    header(value) {
      header = value;
    },
    node(id, latNano, lonNano, tags) {
      if (!tags) return;
      const point = { lat: nanoToDegrees(latNano), lon: nanoToDegrees(lonNano) };
      if (isPharmacy(tags)) pharmacyNodes.push({ id: `node/${id}`, tags, centre: point });
      if ((PLACE_TYPES as readonly string[]).includes(tags.place ?? "") && tags.name?.trim()) {
        placeNodes.set(id, { tags, point });
      }
    },
    relation(id, members, tags) {
      if (!tags) return;
      if (isPharmacy(tags)) pharmacyRelations.push({ id, tags, members });
      if (tags.boundary !== "administrative") return;
      if (tags.admin_level === "2" && tags["ISO3166-1"]?.toUpperCase() === region) {
        country = { id, tags, members };
      } else if (tags.admin_level === options.municipalityAdminLevel && tags.name?.trim()) {
        municipalities.push({ id, tags, members });
      }
    },
  });
  log(
    `pass 1: ${pharmacyNodes.length} pharmacy nodes, ${pharmacyRelations.length} pharmacy relations, ` +
      `${placeNodes.size} places, ${municipalities.length} municipalities, ` +
      `country boundary ${country ? `relation/${country.id}` : "not found"}`,
  );
  if (options.regionFilter === "boundary" && !country) {
    throw new Error(
      `No boundary=administrative admin_level=2 relation with ISO3166-1=${region} in the extract. ` +
        "Check --region, or pass --region-filter extract to keep the whole extract.",
    );
  }

  const boundaryRelations = [
    ...(options.regionFilter === "boundary" && country ? [country] : []),
    ...municipalities,
  ];
  const neededWays = new Set<number>();
  for (const relation of [...pharmacyRelations, ...boundaryRelations]) {
    for (const member of relation.members) {
      if (member.type === "way") neededWays.add(member.ref);
    }
  }

  // Pass 2: ways.
  const nodes = new NodeStore();
  const wayRefs = new Map<number, number[]>();
  const maritimeWays = new Set<number>();
  const pharmacyWays: { id: number; tags: Tags }[] = [];
  readPbf(path, {
    tagKeys: new Set(["amenity", "maritime"]),
    wantWay: (id, tags) => isPharmacy(tags) || neededWays.has(id),
    way(id, refs, tags) {
      wayRefs.set(id, refs);
      if (tags?.maritime === "yes") maritimeWays.add(id);
      for (const ref of refs) nodes.add(ref);
      if (isPharmacy(tags) && tags) pharmacyWays.push({ id, tags });
    },
  });
  for (const relation of municipalities) {
    for (const member of relation.members) {
      if (member.type === "node" && (member.role === "admin_centre" || member.role === "label")) {
        nodes.add(member.ref);
      }
    }
  }
  nodes.freeze();
  log(
    `pass 2: ${pharmacyWays.length} pharmacy ways, ${wayRefs.size} ways, ${nodes.ids.length} nodes to locate`,
  );

  // Pass 3: coordinates of the needed nodes.
  let located = 0;
  readPbf(path, {
    tagKeys: new Set(),
    node(id, latNano, lonNano) {
      const index = nodes.indexOf(id);
      if (index >= 0) {
        nodes.set(index, latNano, lonNano);
        located++;
      }
    },
  });
  log(`pass 3: located ${located} of ${nodes.ids.length} nodes`);

  const positionsOf = (refs: readonly number[]) =>
    refs.map((ref) => nodes.position(ref)).filter((p): p is Position => p !== undefined);

  const ringsOf = (relation: PendingRelation, label: string, warn = true): Ring[] => {
    const memberWays = relation.members
      .filter(
        (member) =>
          member.type === "way" &&
          (member.role === "outer" || member.role === "inner" || member.role === ""),
      )
      .map((member) => wayRefs.get(member.ref))
      .filter((refs): refs is number[] => refs !== undefined);
    const { rings, open } = assembleRings(memberWays);
    if (warn && open.length > 0)
      warnings.push(`${label}: ${open.length} unclosed ring chain(s) ignored`);
    return rings.map((ring) => positionsOf(ring)).filter((ring) => ring.length >= 4);
  };

  const features: RawFeature[] = [...pharmacyNodes];
  for (const { id, tags } of pharmacyWays) {
    const refs = wayRefs.get(id) ?? [];
    const positions = positionsOf(refs);
    const box = bboxOf(positions);
    if (!box) {
      warnings.push(`way/${id}: no node coordinates in the extract, skipped`);
      continue;
    }
    const closed = refs.length >= 4 && refs[0] === refs.at(-1) && positions.length === refs.length;
    features.push({
      id: `way/${id}`,
      tags,
      centre: bboxCentre(box),
      ...(closed ? { rings: [positions] } : {}),
    });
  }
  for (const relation of pharmacyRelations) {
    const label = `relation/${relation.id}`;
    const positions = relation.members
      .filter((member) => member.type === "way")
      .flatMap((member) => positionsOf(wayRefs.get(member.ref) ?? []));
    const box = bboxOf(positions);
    if (!box) {
      warnings.push(`${label}: no member way geometry in the extract, skipped`);
      continue;
    }
    const rings = ringsOf(relation, label);
    features.push({
      id: label,
      tags: relation.tags,
      centre: bboxCentre(box),
      ...(rings.length ? { rings } : {}),
    });
  }

  let regionRings: Ring[] | undefined;
  let regionBox: BBox | undefined;
  if (options.regionFilter === "boundary" && country) {
    regionRings = ringsOf(country, `relation/${country.id} (country boundary)`);
    if (regionRings.length === 0)
      throw new Error(`Country boundary relation/${country.id} has no closed rings`);
    regionBox = bboxOf(regionRings.flat());
  }
  const inRegion = (point: LatLon) =>
    !regionRings ||
    (!!regionBox &&
      point.lat >= regionBox.minLat &&
      point.lat <= regionBox.maxLat &&
      point.lon >= regionBox.minLon &&
      point.lon <= regionBox.maxLon &&
      pointInArea(point, regionRings));
  const outsideRegion = features.filter((f) => !inRegion(f.centre)).map((f) => f.id);
  const outside = new Set(outsideRegion);

  const municipalityAreas = municipalities
    .map((relation) => {
      // Boundaries of neighbouring municipalities are often cut at the extract edge; those
      // without a closed ring are skipped and counted instead of logged one by one.
      const rings = ringsOf(relation, `relation/${relation.id}`, false);
      return { relation, rings, box: bboxOf(rings.flat()) };
    })
    .filter((area) => area.rings.length > 0 && area.box);
  const municipalitiesWithoutGeometry = municipalities.length - municipalityAreas.length;
  const municipalityOf = (point: LatLon) =>
    municipalityAreas
      .find(
        ({ rings, box }) =>
          box &&
          point.lat >= box.minLat &&
          point.lat <= box.maxLat &&
          point.lon >= box.minLon &&
          point.lon <= box.maxLon &&
          pointInArea(point, rings),
      )
      ?.relation.tags.name?.trim();

  const places: Place[] = [];
  for (const { relation, rings } of municipalityAreas) {
    const centreRef = relation.members.find(
      (m) => m.type === "node" && (m.role === "admin_centre" || m.role === "label"),
    )?.ref;
    const centrePosition = centreRef === undefined ? undefined : nodes.position(centreRef);
    const point = centrePosition
      ? { lat: roundCoordinate(centrePosition[1]), lon: roundCoordinate(centrePosition[0]) }
      : interiorPoint(rings, 1e-4);
    if (!point || !inRegion(point)) continue;
    places.push(placeRecord(`relation/${relation.id}`, relation.tags, "municipality", point));
  }
  for (const [id, { tags, point }] of placeNodes) {
    if (!inRegion(point)) continue;
    const municipality = municipalityOf(point);
    places.push({
      ...placeRecord(`node/${id}`, tags, tags.place as PlaceType, point),
      ...(municipality ? { municipality } : {}),
    });
  }

  const coverage =
    country && regionRings
      ? {
          rings: regionRings.map(simplifyBoundary).filter((ring) => ring.length >= 4),
          landBorders: country.members
            .filter((member) => member.type === "way" && !maritimeWays.has(member.ref))
            .map((member) => simplifyBoundary(positionsOf(wayRefs.get(member.ref) ?? [])))
            .filter((line) => line.length >= 2),
        }
      : undefined;

  return {
    header,
    ...(coverage ? { coverage } : {}),
    features: features.filter((f) => !outside.has(f.id)),
    places: places.toSorted((a, b) => compareIds(a.id, b.id)),
    ...(country ? { boundaryId: `relation/${country.id}` } : {}),
    outsideRegion: outsideRegion.toSorted(compareIds),
    municipalitiesWithoutGeometry,
    warnings,
  };
}

function placeRecord(id: string, tags: Tags, type: PlaceType, point: LatLon): Place {
  const nameSv = tags["name:sv"]?.trim();
  return {
    id,
    name: tags.name?.trim() ?? "",
    ...(nameSv && nameSv !== tags.name?.trim() ? { nameSv } : {}),
    type,
    lat: point.lat,
    lon: point.lon,
  };
}
