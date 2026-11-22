import type { LatLon } from "../../shared/geo/haversine";

/** OSM node/25474663, Helsinki Central Railway Station, as in the ranking fixture. */
export const defaultOrigin: Origin = { kind: "default", lat: 60.1720965, lon: 24.9412486 };

export type Origin = LatLon &
  (
    | { readonly kind: "default" | "device" | "pin" }
    | {
        readonly kind: "search";
        readonly label: string;
        readonly title: string;
        readonly context: string;
      }
  );
