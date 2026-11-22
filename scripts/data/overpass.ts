// Reads an Overpass API JSON response from an `out center tags` query (see
// docs/research/queries/finland-pharmacies.overpassql). Areas carry only their bounding-box centre,
// so records get no interior pin and the duplicate rule can use the 50 m distance only.

import { roundCoordinate } from "./geometry.ts";
import type { RawFeature } from "./normalize.ts";
import type { Tags } from "./osm-pbf.ts";

interface OverpassElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Tags;
}

export interface OverpassResponse {
  osm3s?: { timestamp_osm_base?: string; copyright?: string };
  elements: OverpassElement[];
}

export function featuresFromOverpass(response: OverpassResponse): {
  features: RawFeature[];
  skipped: string[];
} {
  const features: RawFeature[] = [];
  const skipped: string[] = [];
  for (const element of response.elements) {
    const id = `${element.type}/${element.id}`;
    if (element.tags?.amenity !== "pharmacy") continue;
    const point = element.type === "node" ? element : element.center;
    if (point?.lat === undefined || point.lon === undefined) {
      skipped.push(id);
      continue;
    }
    features.push({
      id,
      tags: element.tags,
      centre: { lat: roundCoordinate(point.lat), lon: roundCoordinate(point.lon) },
    });
  }
  return { features, skipped };
}
