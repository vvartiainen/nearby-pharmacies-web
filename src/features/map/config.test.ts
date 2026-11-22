import { describe, expect, it } from "vitest";
import { attributionHtml, defaultTileSettings, tileSettingsFrom } from "./config";

describe("tileSettingsFrom", () => {
  it("defaults to OSM Standard tiles from ADR 0002", () => {
    expect(tileSettingsFrom({})).toEqual({
      url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      maxZoom: 19,
      attributionText: null,
      attributionUrl: "https://www.openstreetmap.org/copyright",
    });
  });

  it("reads overrides from the build environment", () => {
    expect(
      tileSettingsFrom({
        VITE_TILE_URL: "https://tiles.example/{z}/{x}/{y}.png",
        VITE_TILE_MAX_ZOOM: "18",
        VITE_TILE_ATTRIBUTION: "© Example",
        VITE_TILE_ATTRIBUTION_URL: "https://example.org/",
      }),
    ).toEqual({
      url: "https://tiles.example/{z}/{x}/{y}.png",
      maxZoom: 18,
      attributionText: "© Example",
      attributionUrl: "https://example.org/",
    });
  });

  it("ignores an invalid max zoom", () => {
    expect(tileSettingsFrom({ VITE_TILE_MAX_ZOOM: "high" }).maxZoom).toBe(
      defaultTileSettings.maxZoom,
    );
  });
});

describe("attributionHtml", () => {
  it("links the escaped text to the copyright page", () => {
    expect(attributionHtml("© A & <B>", "https://x.org/?a=1&b=2")).toBe(
      '<a href="https://x.org/?a=1&amp;b=2" target="_blank" rel="noopener">© A &amp; &lt;B&gt;</a>',
    );
  });
});
