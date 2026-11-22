/** A shard covers half a degree of latitude and one degree of longitude. */
export function addressCell(lat: number, lon: number): string {
  return `${Math.floor(lat * 2)}-${Math.floor(lon)}`;
}

export const addressCoordinateScale = 100_000;
export const addressRadiusMeters = 120;

export interface AddressShard {
  readonly streets: readonly string[];
  readonly cities: readonly string[];
  readonly points: readonly (readonly [
    lat: number,
    lon: number,
    street: number,
    number: string,
    city: number,
  ])[];
}
