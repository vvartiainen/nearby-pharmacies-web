import type { CoverageGeometry } from "../../data/schema";
import { EARTH_MEAN_RADIUS_METERS, type LatLon } from "../../shared/geo/haversine";

const imports = import.meta.glob<CoverageGeometry>("../../data/coverage.fi.json", {
  eager: true,
  import: "default",
});
const coverage = imports["../../data/coverage.fi.json"];
const radians = Math.PI / 180;

export function originCoverage(point: LatLon): "covered" | "border" | "outside" {
  if (!coverage) return "covered";
  let inside = false;
  for (const ring of coverage.rings) {
    for (let i = 1; i < ring.length; i++) {
      const [lonA, latA] = ring[i - 1]!;
      const [lonB, latB] = ring[i]!;
      if (latA > point.lat === latB > point.lat) continue;
      const intersection = lonA + ((lonB - lonA) * (point.lat - latA)) / (latB - latA);
      if (point.lon < intersection) inside = !inside;
    }
  }
  if (!inside) return "outside";

  // An equirectangular projection centred on the origin is sufficient for the 5 km notice.
  const scaleX = radians * EARTH_MEAN_RADIUS_METERS * Math.cos(point.lat * radians);
  const scaleY = radians * EARTH_MEAN_RADIUS_METERS;
  for (const line of coverage.landBorders) {
    for (let i = 1; i < line.length; i++) {
      const [lonA, latA] = line[i - 1]!;
      const [lonB, latB] = line[i]!;
      const [ax, ay] = [(lonA - point.lon) * scaleX, (latA - point.lat) * scaleY];
      const [dx, dy] = [(lonB - lonA) * scaleX, (latB - latA) * scaleY];
      const lengthSquared = dx * dx + dy * dy;
      const fraction =
        lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / lengthSquared));
      if ((ax + fraction * dx) ** 2 + (ay + fraction * dy) ** 2 <= 5000 ** 2) return "border";
    }
  }
  return "covered";
}
