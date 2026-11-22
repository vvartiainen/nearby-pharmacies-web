// Shapes of the bundled data files written by `pnpm run data:import`. See docs/data/README.md.
// Optional fields are omitted when OpenStreetMap has no value; they are never null.

export interface PharmacyAddress {
  street?: string;
  housenumber?: string;
  postcode?: string;
  city?: string;
}

export interface Pharmacy {
  /** Stable OSM ID: "node/123", "way/123" or "relation/123". */
  id: string;
  name?: string;
  /** Point used for distance: the node, or the bounding-box centre of an area (ADR 0001). */
  lat: number;
  lon: number;
  /** Interior point for the map pin of an area; absent for nodes (use lat/lon). */
  pin?: { lat: number; lon: number };
  address?: PharmacyAddress;
  /** Raw OSM `opening_hours`. */
  openingHours?: string;
  dispensing?: string;
  phone?: string;
  website?: string;
  wheelchair?: string;
}

export interface PharmacySnapshot {
  schemaVersion: number;
  region: string;
  pharmacies: Pharmacy[];
}

export type PlaceType = "municipality" | "city" | "town" | "village";

export interface Place {
  /** OSM ID of the place node, or of the boundary relation for a municipality. */
  id: string;
  name: string;
  nameSv?: string;
  type: PlaceType;
  lat: number;
  lon: number;
  /** Name of the containing municipality (admin boundary); absent when not resolved. */
  municipality?: string;
}

export interface PlaceIndex {
  schemaVersion: number;
  region: string;
  places: Place[];
}
