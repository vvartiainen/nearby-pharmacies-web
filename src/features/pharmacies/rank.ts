import { haversineMeters, type LatLon } from "../../shared/geo/haversine.ts";

export interface Rankable extends LatLon {
  readonly id: string;
}

export interface RankedPharmacy<T extends Rankable> {
  readonly pharmacy: T;
  /** Unrounded straight-line distance in metres. Round only for display. */
  readonly distanceMeters: number;
}

/** Plain UTF-16 code-unit comparison, the same as Swift's comparison of `String.utf16` views. */
export function compareIds(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

/**
 * Ranks pharmacies by unrounded haversine distance from the origin, then by `id` for exact ties.
 * Returns every pharmacy, so the nearest available result is present even far from any pharmacy.
 */
export function rankPharmacies<T extends Rankable>(
  origin: LatLon,
  pharmacies: readonly T[],
): RankedPharmacy<T>[] {
  return pharmacies
    .map((pharmacy) => ({ pharmacy, distanceMeters: haversineMeters(origin, pharmacy) }))
    .toSorted(
      (a, b) => a.distanceMeters - b.distanceMeters || compareIds(a.pharmacy.id, b.pharmacy.id),
    );
}
