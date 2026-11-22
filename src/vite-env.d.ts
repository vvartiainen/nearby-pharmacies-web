/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Tile URL template; default OSM Standard (ADR 0002). */
  readonly VITE_TILE_URL?: string;
  /** Highest tile zoom level; default 19. */
  readonly VITE_TILE_MAX_ZOOM?: string;
  /** Attribution text; default "© OpenStreetMap contributors". */
  readonly VITE_TILE_ATTRIBUTION?: string;
  /** Attribution link target; default https://www.openstreetmap.org/copyright. */
  readonly VITE_TILE_ATTRIBUTION_URL?: string;
  readonly VITE_GEOCODER_PROVIDER?: string;
  readonly VITE_GEOAPIFY_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
