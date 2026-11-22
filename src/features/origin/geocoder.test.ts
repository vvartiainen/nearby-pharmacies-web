import { afterEach, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.resetModules();
});

const sampleGeometry = { type: "Point", coordinates: [23.75937, 61.49819] };
const expected = {
  title: "Kauppakatu 1",
  context: "Tampere, Finland",
  label: "Kauppakatu 1 · Tampere, Finland",
  lon: 23.75937,
  lat: 61.49819,
};

it("can switch to a configured Photon endpoint without a build", async () => {
  const fetch = vi
    .fn<typeof globalThis.fetch>()
    .mockResolvedValueOnce(
      Response.json({
        provider: "photon",
        endpoint: "https://photon.example/api",
        countryCode: "fi",
      }),
    )
    .mockResolvedValueOnce(
      Response.json({
        features: [
          {
            geometry: sampleGeometry,
            properties: {
              street: "Kauppakatu",
              housenumber: "1",
              city: "Tampere",
              country: "Finland",
              countrycode: "FI",
            },
          },
        ],
      }),
    );
  vi.stubGlobal("fetch", fetch);
  const { createGeocoder } = await import("./geocoder");
  const matches = await createGeocoder().search("Kauppakatu 1", "en", new AbortController().signal);
  expect(matches).toEqual([expected]);
  expect(String(fetch.mock.calls[1]?.[0])).toContain("https://photon.example/api?");
  expect(new URL(String(fetch.mock.calls[1]?.[0])).searchParams.get("countrycode")).toBe("FI");
});

it("uses the configured Geoapify provider and key", async () => {
  vi.stubEnv("VITE_GEOCODER_PROVIDER", "geoapify");
  vi.stubEnv("VITE_GEOAPIFY_KEY", "test-key");
  const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValueOnce(
    Response.json({
      features: [
        {
          geometry: sampleGeometry,
          properties: {
            street: "Kauppakatu",
            housenumber: "1",
            city: "Tampere",
            country: "Finland",
            country_code: "fi",
          },
        },
      ],
    }),
  );
  vi.stubGlobal("fetch", fetch);
  const { createGeocoder } = await import("./geocoder");
  const matches = await createGeocoder().search("Kauppakatu 1", "en", new AbortController().signal);
  expect(matches).toEqual([expected]);
  const url = new URL(String(fetch.mock.calls[0]?.[0]));
  expect(url.searchParams.get("filter")).toBe("countrycode:fi");
  expect(url.searchParams.get("apiKey")).toBe("test-key");
});
