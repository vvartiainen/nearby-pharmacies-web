import { EARTH_MEAN_RADIUS_METERS, haversineMeters, type LatLon } from "../ranking/haversine";
import {
  addressCell,
  addressCoordinateScale,
  addressRadiusMeters,
  type AddressShard,
} from "./addressGrid";
import { originCoverage } from "./coverage";

function nearbyCells(point: LatLon) {
  const radiusDegrees = (addressRadiusMeters / EARTH_MEAN_RADIUS_METERS) * (180 / Math.PI);
  const longitudeRadius = radiusDegrees / Math.cos((point.lat * Math.PI) / 180);
  const cells = new Set<string>();
  for (const lat of [point.lat - radiusDegrees, point.lat + radiusDegrees]) {
    for (const lon of [point.lon - longitudeRadius, point.lon + longitudeRadius]) {
      cells.add(addressCell(lat, lon));
    }
  }
  return cells;
}

export interface DeviceAddress {
  readonly street: string;
  readonly city: string;
}

function nearestAddress(point: LatLon, shards: readonly AddressShard[]) {
  // Check latitude first to avoid projecting out-of-range addresses in the whole shard.
  const latitudeWindow =
    (addressRadiusMeters / EARTH_MEAN_RADIUS_METERS) * (180 / Math.PI) * addressCoordinateScale;
  const originLatitude = point.lat * addressCoordinateScale;
  let closest = addressRadiusMeters;
  let address: DeviceAddress | undefined;

  for (const shard of shards) {
    for (const [lat, lon, street, number, city] of shard.points) {
      if (lat < originLatitude - latitudeWindow) continue;
      if (lat > originLatitude + latitudeWindow) break;
      const addressPoint = { lat: lat / addressCoordinateScale, lon: lon / addressCoordinateScale };
      const distance = haversineMeters(point, addressPoint);
      if (distance > closest || originCoverage(addressPoint) === "outside") continue;
      closest = distance;
      address = { street: `${shard.streets[street]} ${number}`, city: shard.cities[city] ?? "" };
    }
  }
  return address;
}

async function fetchShard(
  baseUrl: string,
  cell: string,
  signal: AbortSignal,
): Promise<AddressShard | undefined> {
  try {
    const response = await fetch(`${baseUrl}${cell}.json.gz`, { signal });
    if (!response.ok) return undefined;
    const bytes = new Uint8Array(await response.arrayBuffer());
    // Some static hosts send Content-Encoding: gzip, which the browser has already decoded.
    if (bytes[0] !== 0x1f || bytes[1] !== 0x8b) {
      return JSON.parse(new TextDecoder().decode(bytes)) as AddressShard;
    }
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
    return (await new Response(stream).json()) as AddressShard;
  } catch {
    return undefined;
  }
}

/** Requests fixed same-origin data files. The GPS coordinates are used only in the browser. */
export async function findDeviceAddress(point: LatLon, accuracy: number, signal: AbortSignal) {
  if (
    !Number.isFinite(accuracy) ||
    accuracy > addressRadiusMeters ||
    originCoverage(point) === "outside"
  )
    return undefined;
  const baseUrl = `${import.meta.env.BASE_URL}address-index/`;
  const request = AbortSignal.any([signal, AbortSignal.timeout(5000)]);
  const response = await fetch(`${baseUrl}index.json`, { signal: request });
  if (!response.ok) return undefined;
  const cells: unknown = await response.json();
  if (!Array.isArray(cells)) return undefined;
  const shards = await Promise.all(
    [...nearbyCells(point)]
      .filter((cell) => cells.includes(cell))
      .map((cell) => fetchShard(baseUrl, cell, request)),
  );
  request.throwIfAborted();
  return nearestAddress(
    point,
    shards.filter((shard) => shard !== undefined),
  );
}
