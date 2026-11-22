/**
 * Mean Earth radius in metres (IUGG mean radius R1 = 6371.0088 km). This is the single source of
 * the constant for the web app and the importer; the shared ranking fixture records the same
 * value so the iOS app can assert it uses it too.
 */
export const EARTH_MEAN_RADIUS_METERS = 6_371_008.8;

export interface LatLon {
  readonly lat: number;
  readonly lon: number;
}

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

/** Great-circle distance in metres with the haversine formula on a sphere of the mean radius. */
export function haversineMeters(from: LatLon, to: LatLon): number {
  const phi1 = toRadians(from.lat);
  const phi2 = toRadians(to.lat);
  const dPhi = toRadians(to.lat - from.lat);
  const dLambda = toRadians(to.lon - from.lon);
  const h = Math.sin(dPhi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) ** 2;
  return 2 * EARTH_MEAN_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(h)));
}
