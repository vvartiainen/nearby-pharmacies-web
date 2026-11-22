import type { Pharmacy, PharmacyAddress } from "../../src/data/schema.ts";
import { haversineMeters, type LatLon } from "../../src/shared/geo/haversine.ts";
import { compareIds } from "../../src/features/pharmacies/rank.ts";
import { interiorPoint, pointInArea, type Ring } from "./geometry.ts";
import type { Tags } from "./osm-pbf.ts";

/** ADR 0001 duplicate rule thresholds. */
export const DUPLICATE_RADIUS_METERS = 50;
export const SAME_NAME_REVIEW_METERS = 1000;

export interface RawFeature {
  id: string;
  tags: Tags;
  /** Representative point: the node, or the bounding-box centre of an area. */
  centre: LatLon;
  /** Closed outline rings of an area, when the geometry is known. */
  rings?: Ring[];
}

export interface DroppedDuplicate {
  id: string;
  keptId: string;
  reason: "within-50m" | "inside-outline";
  distanceMeters: number;
}

export interface SameNamePair {
  name: string;
  ids: [string, string];
  distanceMeters: number;
}

const text = (value: string | undefined) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

export const featureName = (feature: RawFeature) => text(feature.tags.name);

function addressOf(tags: Tags): PharmacyAddress | undefined {
  const address: PharmacyAddress = {};
  const street = text(tags["addr:street"]) ?? text(tags["addr:place"]);
  const housenumber = text(tags["addr:housenumber"]);
  const postcode = text(tags["addr:postcode"]);
  const city = text(tags["addr:city"]);
  if (street) address.street = street;
  if (housenumber) address.housenumber = housenumber;
  if (postcode) address.postcode = postcode;
  if (city) address.city = city;
  return Object.keys(address).length > 0 ? address : undefined;
}

/** Maps tags to the snapshot record. Key order here is the key order in the output file. */
export function toPharmacy(feature: RawFeature): Pharmacy {
  const { tags } = feature;
  const name = featureName(feature);
  const record: Pharmacy = {
    id: feature.id,
    ...(name ? { name } : {}),
    lat: feature.centre.lat,
    lon: feature.centre.lon,
  };
  const pin = feature.rings && feature.rings.length > 0 ? interiorPoint(feature.rings) : undefined;
  if (pin) record.pin = { lat: pin.lat, lon: pin.lon };
  const address = addressOf(tags);
  if (address) record.address = address;
  const openingHours = text(tags.opening_hours);
  if (openingHours) record.openingHours = openingHours;
  const dispensing = text(tags.dispensing);
  if (dispensing) record.dispensing = dispensing;
  const phone = text(tags.phone) ?? text(tags["contact:phone"]);
  if (phone) record.phone = phone;
  const website = text(tags.website) ?? text(tags["contact:website"]);
  if (website) record.website = website;
  const wheelchair = text(tags.wheelchair);
  if (wheelchair) record.wheelchair = wheelchair;
  return record;
}

const roundTenth = (meters: number) => Math.round(meters * 10) / 10;

/**
 * ADR 0001: drop a feature that has no name and lies within 50 m of a named pharmacy, or inside
 * its outline. Keep everything else, even close neighbours. Same-name pairs within 1 km are
 * reported for manual review, not merged.
 */
export function applyDuplicateRule(features: readonly RawFeature[]): {
  kept: RawFeature[];
  dropped: DroppedDuplicate[];
  sameNamePairs: SameNamePair[];
} {
  const named = features.filter((feature) => featureName(feature));
  const dropped: DroppedDuplicate[] = [];
  const droppedIds = new Set<string>();
  for (const feature of features) {
    if (featureName(feature)) continue;
    let best: DroppedDuplicate | undefined;
    for (const candidate of named) {
      const distanceMeters = haversineMeters(feature.centre, candidate.centre);
      const inside = candidate.rings ? pointInArea(feature.centre, candidate.rings) : false;
      if (!inside && distanceMeters > DUPLICATE_RADIUS_METERS) continue;
      const match: DroppedDuplicate = {
        id: feature.id,
        keptId: candidate.id,
        reason: inside ? "inside-outline" : "within-50m",
        distanceMeters: roundTenth(distanceMeters),
      };
      if (
        !best ||
        distanceMeters < best.distanceMeters ||
        (distanceMeters === best.distanceMeters && compareIds(candidate.id, best.keptId) < 0)
      ) {
        best = match;
      }
    }
    if (best) {
      dropped.push(best);
      droppedIds.add(feature.id);
    }
  }

  const sameNamePairs: SameNamePair[] = [];
  const byName = new Map<string, RawFeature[]>();
  for (const feature of named) {
    const key = (featureName(feature) ?? "").toLocaleLowerCase("fi");
    byName.set(key, [...(byName.get(key) ?? []), feature]);
  }
  for (const group of byName.values()) {
    const sorted = group.toSorted((a, b) => compareIds(a.id, b.id));
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const a = sorted[i];
        const b = sorted[j];
        if (!a || !b) continue;
        const distanceMeters = haversineMeters(a.centre, b.centre);
        if (distanceMeters <= SAME_NAME_REVIEW_METERS) {
          sameNamePairs.push({
            name: featureName(a) ?? "",
            ids: [a.id, b.id],
            distanceMeters: roundTenth(distanceMeters),
          });
        }
      }
    }
  }

  return {
    kept: features.filter((feature) => !droppedIds.has(feature.id)),
    dropped: dropped.toSorted((a, b) => compareIds(a.id, b.id)),
    sameNamePairs: sameNamePairs.toSorted((a, b) => compareIds(a.ids[0], b.ids[0])),
  };
}

/** Normalizes, deduplicates and sorts by ID for stable diffs. */
export function buildPharmacies(features: readonly RawFeature[]) {
  const { kept, dropped, sameNamePairs } = applyDuplicateRule(features);
  const pharmacies = kept.map(toPharmacy).toSorted((a, b) => compareIds(a.id, b.id));
  return { pharmacies, dropped, sameNamePairs };
}
