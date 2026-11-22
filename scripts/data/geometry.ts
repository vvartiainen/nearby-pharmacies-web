import polylabel from "polylabel";
import type { LatLon } from "../../src/ranking/haversine.ts";

/** [lon, lat] in degrees. */
export type Position = readonly [number, number];
/** A closed ring: the first and last positions are equal. */
export type Ring = readonly Position[];

export interface BBox {
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
}

/** OSM stores coordinates with 7 decimals; the snapshot keeps that precision. */
export const roundCoordinate = (degrees: number) => Number(degrees.toFixed(7));

export function bboxOf(positions: Iterable<Position>): BBox | undefined {
  let box: BBox | undefined;
  for (const [lon, lat] of positions) {
    if (!box) box = { minLon: lon, minLat: lat, maxLon: lon, maxLat: lat };
    else {
      box.minLon = Math.min(box.minLon, lon);
      box.minLat = Math.min(box.minLat, lat);
      box.maxLon = Math.max(box.maxLon, lon);
      box.maxLat = Math.max(box.maxLat, lat);
    }
  }
  return box;
}

/** Bounding-box centre, the representative point for distance per ADR 0001 (same as Overpass `center`). */
export function bboxCentre(box: BBox): LatLon {
  return {
    lat: roundCoordinate((box.minLat + box.maxLat) / 2),
    lon: roundCoordinate((box.minLon + box.maxLon) / 2),
  };
}

/**
 * Joins way node lists into closed rings by matching end points, reversing ways where needed.
 * Chains that cannot be closed are returned in `open` so callers can report incomplete data.
 */
export function assembleRings(ways: readonly (readonly number[])[]): {
  rings: number[][];
  open: number[][];
} {
  const rings: number[][] = [];
  const open: number[][] = [];
  const pending = ways.filter((way) => way.length >= 2).map((way) => [...way]);
  while (pending.length > 0) {
    const chain = pending.shift() ?? [];
    let extended = true;
    while (chain[0] !== chain.at(-1) && extended) {
      extended = false;
      for (let index = 0; index < pending.length; index++) {
        const way = pending[index] ?? [];
        const head = chain.at(-1);
        if (way[0] === head) chain.push(...way.slice(1));
        else if (way.at(-1) === head) chain.push(...way.toReversed().slice(1));
        else if (way.at(-1) === chain[0]) chain.unshift(...way.slice(0, -1));
        else if (way[0] === chain[0]) chain.unshift(...way.toReversed().slice(0, -1));
        else continue;
        pending.splice(index, 1);
        extended = true;
        break;
      }
    }
    if (chain.length >= 4 && chain[0] === chain.at(-1)) rings.push(chain);
    else open.push(chain);
  }
  return { rings, open };
}

/** Ray casting on one ring (planar lon/lat; adequate for pharmacy outlines and boundaries). */
export function pointInRing(point: LatLon, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i] ?? [0, 0];
    const [xj, yj] = ring[j] ?? [0, 0];
    if (yi > point.lat !== yj > point.lat) {
      const x = ((xj - xi) * (point.lat - yi)) / (yj - yi) + xi;
      if (point.lon < x) inside = !inside;
    }
  }
  return inside;
}

/**
 * Even-odd test over all rings of an area. For a valid multipolygon this equals "inside an outer
 * ring and not inside one of its holes", without relying on member roles.
 */
export function pointInArea(point: LatLon, rings: readonly Ring[]): boolean {
  let inside = false;
  for (const ring of rings) if (pointInRing(point, ring)) inside = !inside;
  return inside;
}

function ringArea(ring: Ring): number {
  let area = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i] ?? [0, 0];
    const [xj, yj] = ring[j] ?? [0, 0];
    area += (xj + xi) * (yj - yi);
  }
  return Math.abs(area / 2);
}

/**
 * A point inside the area, for map pins. Uses the pole of inaccessibility (polylabel) of the
 * largest outer ring with the holes it contains, computed in a locally equirectangular plane so
 * that the cell search is not stretched by latitude. Falls back to a ring vertex only if the
 * result is not inside, which polylabel does not produce for valid outlines.
 */
export function interiorPoint(rings: readonly Ring[], precision = 1e-7): LatLon | undefined {
  const sorted = rings
    .filter((ring) => ring.length >= 4)
    .toSorted((a, b) => ringArea(b) - ringArea(a));
  // The largest ring cannot lie inside another ring, so it is an outer ring.
  const outer = sorted[0];
  if (!outer) return undefined;
  const holes = sorted.filter((ring) => {
    if (ring === outer) return false;
    const [lon, lat] = ring[0] ?? [0, 0];
    return pointInRing({ lat, lon }, outer);
  });
  const lat0 = ((bboxOf(outer)?.minLat ?? 0) * Math.PI) / 180;
  const scale = Math.cos(lat0);
  const project = (ring: Ring) => ring.map(([lon, lat]) => [lon * scale, lat]);
  const [x, y] = polylabel([project(outer), ...holes.map(project)], precision);
  const candidate = { lat: roundCoordinate(y ?? 0), lon: roundCoordinate((x ?? 0) / scale) };
  if (pointInArea(candidate, [outer, ...holes])) return candidate;
  const [lon, lat] = outer[0] ?? [0, 0];
  return { lat, lon };
}

/** Simplify the boundary for the UI, within roughly 110 m in latitude. */
export function simplifyBoundary(positions: readonly Position[]): Position[] {
  const first = positions[0];
  const last = positions.at(-1);
  if (!first || !last) return [];
  const [dx, dy] = [last[0] - first[0], last[1] - first[1]];
  const lengthSquared = dx * dx + dy * dy;
  let furthest = 0;
  let maxSquaredDistance = 0.001 ** 2;

  for (let i = 1; i < positions.length - 1; i++) {
    const [x, y] = positions[i]!;
    const [px, py] = [x - first[0], y - first[1]];
    const fraction =
      lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, (px * dx + py * dy) / lengthSquared));
    const squaredDistance = (px - fraction * dx) ** 2 + (py - fraction * dy) ** 2;
    if (squaredDistance > maxSquaredDistance) {
      furthest = i;
      maxSquaredDistance = squaredDistance;
    }
  }
  if (furthest === 0) return [first, last];
  const before = simplifyBoundary(positions.slice(0, furthest + 1));
  return [...before.slice(0, -1), ...simplifyBoundary(positions.slice(furthest))];
}
