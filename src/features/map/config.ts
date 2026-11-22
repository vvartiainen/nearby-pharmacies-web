export interface TileSettings {
  /** Leaflet URL template with {z}, {x}, {y} and optionally {s} and {r}. */
  readonly url: string;
  readonly maxZoom: number;
  /** Attribution text; null uses the localized "Map attribution" message. */
  readonly attributionText: string | null;
  readonly attributionUrl: string;
}

export const defaultTileSettings: TileSettings = {
  url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  maxZoom: 19,
  attributionText: null,
  attributionUrl: "https://www.openstreetmap.org/copyright",
};

export function tileSettingsFrom(env: Partial<Record<string, string>>): TileSettings {
  const maxZoom = Number(env.VITE_TILE_MAX_ZOOM);
  return {
    url: env.VITE_TILE_URL || defaultTileSettings.url,
    maxZoom: Number.isInteger(maxZoom) && maxZoom > 0 ? maxZoom : defaultTileSettings.maxZoom,
    attributionText: env.VITE_TILE_ATTRIBUTION || defaultTileSettings.attributionText,
    attributionUrl: env.VITE_TILE_ATTRIBUTION_URL || defaultTileSettings.attributionUrl,
  };
}

export const tileSettings = tileSettingsFrom(import.meta.env);

export function attributionHtml(text: string, url: string): string {
  return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener">${escapeHtml(text)}</a>`;
}

function escapeHtml(text: string): string {
  return text.replace(
    /[&<>"']/g,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!,
  );
}
