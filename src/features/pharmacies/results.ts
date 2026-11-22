import type { Pharmacy } from "../../data/schema";
import type { LatLon } from "../../shared/geo/haversine";
import type { SupportedLocale } from "../../shared/i18n/locale";
import type { Messages } from "../../shared/i18n/messages";
import { distanceBand, formatDistance, formatStraightLine, type DistanceBand } from "./distance";
import { displayName } from "./format";
import { rankPharmacies, type RankedPharmacy } from "./rank";

export const resultLimit = 20;

export interface PharmacyResult {
  readonly pharmacy: Pharmacy;
  readonly name: string;
  readonly distance: string;
  readonly band: DistanceBand;
  readonly straightLine: string;
}

export function pharmacyResults(
  origin: LatLon,
  pharmacies: readonly Pharmacy[],
  locale: SupportedLocale,
  messages: Messages,
): PharmacyResult[] {
  return nearestPharmacies(origin, pharmacies).map(({ pharmacy, distanceMeters }) => ({
    pharmacy,
    name: displayName(pharmacy, messages),
    distance: formatDistance(distanceMeters, locale),
    band: distanceBand(distanceMeters),
    straightLine: formatStraightLine(distanceMeters, locale),
  }));
}

export function nearestPharmacies(
  origin: LatLon,
  pharmacies: readonly Pharmacy[],
  limit = resultLimit,
): RankedPharmacy<Pharmacy>[] {
  return rankPharmacies(origin, pharmacies).slice(0, limit);
}

/** The point where a pharmacy's pin is drawn: the interior point of an area, else its location. */
export function pinPosition(pharmacy: Pharmacy): LatLon {
  return pharmacy.pin ?? { lat: pharmacy.lat, lon: pharmacy.lon };
}
