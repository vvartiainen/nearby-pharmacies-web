import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { haversineMeters } from "../../src/ranking/haversine.ts";
import {
  assembleRings,
  bboxCentre,
  bboxOf,
  interiorPoint,
  pointInArea,
  type Ring,
} from "./geometry.ts";
import { applyDuplicateRule, buildPharmacies, toPharmacy, type RawFeature } from "./normalize.ts";
import { serializeManifest, serializeSnapshot } from "./output.ts";
import { featuresFromOverpass } from "./overpass.ts";
import { importPbf } from "./pbf-import.ts";
import { writeTestPbf, type TestNode } from "./test-support/write-pbf.ts";

// Real outline of way/621397347 (Enonkosken sivuapteekki), an L shape whose bbox centre is
// outside the building. Positions are [lon, lat].
const enonkoski: Ring = [
  [28.9196631, 62.0909554],
  [28.9196078, 62.0910916],
  [28.9197136, 62.091101],
  [28.9196375, 62.0912885],
  [28.9198681, 62.091309],
  [28.9199592, 62.0910846],
  [28.9203476, 62.0911191],
  [28.9203879, 62.0910198],
  [28.9196631, 62.0909554],
];

// Real pair from Helsinki: an unnamed node 7.3 m from Apteekki CityCenter (ADR 0001).
const cityCenter = { lat: 60.1700011, lon: 24.9416154 };
const unnamedNearCityCenter = { lat: 60.1700651, lon: 24.9416439 };
// Real named neighbours at Helsinki Airport, 34.5 m apart: both are kept.
const apteekkiplus = { lat: 60.3179912, lon: 24.9653324 };
const lentoasema = { lat: 60.3177874, lon: 24.9648588 };

describe("geometry", () => {
  it("uses the bounding-box centre for distance, which lies outside the L-shaped outline", () => {
    const centre = bboxCentre(bboxOf(enonkoski)!);
    expect(centre).toEqual({ lat: 62.0911322, lon: 28.9199979 });
    expect(pointInArea(centre, [enonkoski])).toBe(false);
  });

  it("puts the interior pin inside the L-shaped outline", () => {
    const pin = interiorPoint([enonkoski]);
    expect(pin).toBeDefined();
    expect(pointInArea(pin!, [enonkoski])).toBe(true);
  });

  it("puts the pin outside a hole", () => {
    const outer: Ring = [
      [0, 0],
      [0.01, 0],
      [0.01, 0.01],
      [0, 0.01],
      [0, 0],
    ];
    const hole: Ring = [
      [0.002, 0.002],
      [0.008, 0.002],
      [0.008, 0.008],
      [0.002, 0.008],
      [0.002, 0.002],
    ];
    const pin = interiorPoint([hole, outer])!;
    expect(pointInArea(pin, [outer, hole])).toBe(true);
  });

  it("assembles rings from ways in any direction and reports open chains", () => {
    const { rings, open } = assembleRings([
      [1, 2, 3],
      [5, 4, 3],
      [5, 6, 1],
      [10, 11],
    ]);
    expect(rings).toEqual([[1, 2, 3, 4, 5, 6, 1]]);
    expect(open).toEqual([[10, 11]]);
  });
});

const feature = (
  id: string,
  point: { lat: number; lon: number },
  tags: Record<string, string>,
  rings?: Ring[],
): RawFeature => ({
  id,
  tags: { amenity: "pharmacy", ...tags },
  centre: point,
  ...(rings ? { rings } : {}),
});

describe("tag mapping", () => {
  it("maps names, address, hours and optional contact fields", () => {
    const record = toPharmacy(
      feature("node/1", cityCenter, {
        name: " Apteekki CityCenter ",
        "addr:street": "Kaivokatu",
        "addr:housenumber": "8",
        "addr:postcode": "00100",
        "addr:city": "Helsinki",
        opening_hours: "Mo-Fr 08:00-19:00",
        dispensing: "yes",
        "contact:phone": "+358 9 123",
        website: "https://example.fi/",
        wheelchair: "limited",
        brand: "ignored",
      }),
    );
    expect(record).toEqual({
      id: "node/1",
      name: "Apteekki CityCenter",
      lat: 60.1700011,
      lon: 24.9416154,
      address: { street: "Kaivokatu", housenumber: "8", postcode: "00100", city: "Helsinki" },
      openingHours: "Mo-Fr 08:00-19:00",
      dispensing: "yes",
      phone: "+358 9 123",
      website: "https://example.fi/",
      wheelchair: "limited",
    });
    expect(Object.keys(record)[1]).toBe("name");
  });

  it("omits missing name, address and hours instead of writing null", () => {
    const record = toPharmacy(feature("node/2", cityCenter, { name: "  ", opening_hours: "" }));
    expect(record).toEqual({ id: "node/2", lat: 60.1700011, lon: 24.9416154 });
  });

  it("uses addr:place when there is no street", () => {
    expect(
      toPharmacy(feature("node/3", cityCenter, { "addr:place": "Kylä", "addr:housenumber": "2" }))
        .address,
    ).toEqual({
      street: "Kylä",
      housenumber: "2",
    });
  });

  it("adds a pin only for areas", () => {
    expect(
      toPharmacy(feature("way/1", bboxCentre(bboxOf(enonkoski)!), { name: "E" }, [enonkoski])).pin,
    ).toBeDefined();
    expect(toPharmacy(feature("node/4", cityCenter, { name: "N" })).pin).toBeUndefined();
  });
});

describe("duplicate rule", () => {
  it("drops the unnamed node 7.3 m from a named pharmacy and keeps 34.5 m named neighbours", () => {
    expect(haversineMeters(apteekkiplus, lentoasema)).toBeCloseTo(34.5, 1);
    const { kept, dropped } = applyDuplicateRule([
      feature("node/11771777459", cityCenter, { name: "Apteekki CityCenter" }),
      feature("node/12976930478", unnamedNearCityCenter, {}),
      feature("way/1375681869", apteekkiplus, { name: "Apteekkiplus" }),
      feature("relation/20401883", lentoasema, { name: "Lentoaseman apteekki" }),
    ]);
    expect(dropped).toEqual([
      {
        id: "node/12976930478",
        keptId: "node/11771777459",
        reason: "within-50m",
        distanceMeters: 7.3,
      },
    ]);
    expect(kept.map((f) => f.id)).toEqual([
      "node/11771777459",
      "way/1375681869",
      "relation/20401883",
    ]);
  });

  it("keeps an unnamed pharmacy more than 50 m from any named one", () => {
    const far = { lat: cityCenter.lat + 0.001, lon: cityCenter.lon }; // about 111 m north
    const { dropped } = applyDuplicateRule([
      feature("node/1", cityCenter, { name: "A" }),
      feature("node/2", far, {}),
    ]);
    expect(dropped).toEqual([]);
  });

  it("drops an unnamed pharmacy inside a named outline even beyond 50 m", () => {
    const outline: Ring = [
      [24.0, 60.0],
      [24.004, 60.0],
      [24.004, 60.002],
      [24.0, 60.002],
      [24.0, 60.0],
    ];
    const { dropped } = applyDuplicateRule([
      feature("way/1", { lat: 60.001, lon: 24.002 }, { name: "Big" }, [outline]),
      feature("node/2", { lat: 60.0019, lon: 24.0039 }, {}),
    ]);
    expect(dropped).toMatchObject([{ id: "node/2", keptId: "way/1", reason: "inside-outline" }]);
    expect(dropped[0]!.distanceMeters).toBeGreaterThan(50);
  });

  it("reports same-name pairs within 1 km without merging them", () => {
    const { kept, sameNamePairs } = applyDuplicateRule([
      feature(
        "node/285492535",
        { lat: 60.4734399, lon: 25.0857288 },
        { name: "Järvenpään Lähiapteekki" },
      ),
      feature(
        "node/14110808433",
        { lat: 60.4791464, lon: 25.0854054 },
        { name: "Järvenpään Lähiapteekki" },
      ),
    ]);
    expect(kept).toHaveLength(2);
    expect(sameNamePairs).toEqual([
      {
        name: "Järvenpään Lähiapteekki",
        ids: ["node/14110808433", "node/285492535"],
        distanceMeters: 634.8,
      },
    ]);
  });
});

describe("Overpass input", () => {
  it("maps nodes, way and relation centres and skips elements without coordinates", () => {
    const { features, skipped } = featuresFromOverpass({
      elements: [
        { type: "node", id: 1, lat: 60.1, lon: 24.9, tags: { amenity: "pharmacy", name: "N" } },
        { type: "way", id: 2, center: { lat: 60.2, lon: 25.0 }, tags: { amenity: "pharmacy" } },
        {
          type: "relation",
          id: 3,
          center: { lat: 60.3, lon: 25.1 },
          tags: { amenity: "pharmacy" },
        },
        { type: "way", id: 4, tags: { amenity: "pharmacy" } },
        { type: "node", id: 5, lat: 60, lon: 25, tags: { shop: "chemist" } },
      ],
    });
    expect(features.map((f) => [f.id, f.centre])).toEqual([
      ["node/1", { lat: 60.1, lon: 24.9 }],
      ["way/2", { lat: 60.2, lon: 25.0 }],
      ["relation/3", { lat: 60.3, lon: 25.1 }],
    ]);
    expect(features.every((f) => f.rings === undefined)).toBe(true);
    expect(skipped).toEqual(["way/4"]);
  });
});

describe("deterministic output", () => {
  const features = [
    feature("way/5", { lat: 61, lon: 25 }, { name: "W" }, [enonkoski]),
    feature("node/9", { lat: 60, lon: 24 }, { name: "Nine" }),
    feature("node/10", { lat: 60.5, lon: 24.5 }, { name: "Ten", opening_hours: "24/7" }),
    feature("relation/1", { lat: 62, lon: 26 }, {}),
  ];

  it("sorts records by id in code-unit order and ignores input order", () => {
    const a = serializeSnapshot("fi", buildPharmacies(features).pharmacies);
    const b = serializeSnapshot("fi", buildPharmacies(features.toReversed()).pharmacies);
    expect(a).toBe(b);
    expect(buildPharmacies(features).pharmacies.map((p) => p.id)).toEqual([
      "node/10",
      "node/9",
      "relation/1",
      "way/5",
    ]);
    expect(a.split("\n")[1]).toBe(
      '{"id":"node/10","name":"Ten","lat":60.5,"lon":24.5,"openingHours":"24/7"},',
    );
  });

  it("writes no wall-clock time into the manifest", () => {
    const input = {
      region: "fi",
      kind: "osm-pbf" as const,
      notes: [],
      source: {
        url: "u",
        filename: "f",
        sha256: "s",
        bytes: 1,
        dataTimestamp: "2026-11-22T13:04:20Z",
      },
      regionFilter: {},
      files: {},
      counts: {},
      droppedDuplicates: [],
      sameNamePairs: [],
      outsideRegion: [],
      warnings: [],
    };
    expect(JSON.parse(serializeManifest(input)).generatedAt).toBe("2026-11-22T13:04:20Z");
    expect(JSON.parse(serializeManifest(input, "1795000000")).generatedAt).toBe(
      "2026-11-18T11:06:40Z",
    );
  });
});

const square = ([w, s, e, n]: [number, number, number, number], first: number): TestNode[] => [
  { id: first, lat: s, lon: w },
  { id: first + 1, lat: s, lon: e },
  { id: first + 2, lat: n, lon: e },
  { id: first + 3, lat: n, lon: w },
];

describe("PBF import", () => {
  const dir = mkdtempSync(join(tmpdir(), "pbf-import-"));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  // A square "country" (lon 20-31, lat 59-70) made of two ways, one reversed, and a municipality
  // covering its western half.
  const country = square([20, 59, 31, 70], 1);
  const municipality = square([20, 59, 25.5, 70], 11);
  // Airport relation outline about 220 m x 220 m around the relation's bbox centre.
  const airport = square([24.963, 60.3168, 24.967, 60.3188], 21);
  const enonkoskiNodes = enonkoski.slice(0, -1).map(([lon, lat], i) => ({ id: 31 + i, lat, lon }));
  const path = join(dir, "test.osm.pbf");
  writeTestPbf(path, {
    timestamp: 1795353860, // 2026-11-22T13:24:20Z
    nodes: [
      ...country,
      ...municipality,
      ...airport,
      ...enonkoskiNodes,
      { id: 15, lat: 60.2, lon: 24.9 }, // admin centre of the municipality
      {
        id: 100,
        ...cityCenter,
        tags: {
          amenity: "pharmacy",
          name: "Apteekki CityCenter",
          opening_hours: "Mo-Fr 08:00-19:00",
        },
      },
      { id: 101, ...unnamedNearCityCenter, tags: { amenity: "pharmacy" } },
      { id: 102, lat: 60.318, lon: 24.9661, tags: { amenity: "pharmacy" } }, // inside the airport outline
      { id: 103, lat: 60.5, lon: 32.0, tags: { amenity: "pharmacy", name: "Outside" } },
      {
        id: 104,
        lat: 61.5,
        lon: 23.76,
        tags: { place: "city", name: "Tampere", "name:sv": "Tammerfors" },
      },
      { id: 105, lat: 62.0, lon: 28.0, tags: { place: "village", name: "Itäkylä" } },
      { id: 106, lat: 62.0, lon: 28.1, tags: { place: "hamlet", name: "Ignored" } },
    ],
    ways: [
      { id: 1, refs: [1, 2, 3] },
      { id: 2, refs: [1, 4, 3] },
      { id: 11, refs: [11, 12, 13, 14, 11] },
      { id: 21, refs: [21, 22, 23, 24, 21] },
      {
        id: 31,
        refs: [...enonkoskiNodes.map((n) => n.id), 31],
        tags: { amenity: "pharmacy", name: "Enonkosken sivuapteekki", "addr:city": "Enonkoski" },
      },
      { id: 50, refs: [11, 12] }, // unrelated way, never decoded
    ],
    relations: [
      {
        id: 1,
        members: [
          { type: "way", ref: 1, role: "outer" },
          { type: "way", ref: 2, role: "outer" },
        ],
        tags: { type: "boundary", boundary: "administrative", admin_level: "2", "ISO3166-1": "FI" },
      },
      {
        id: 2,
        members: [
          { type: "way", ref: 11, role: "outer" },
          { type: "node", ref: 15, role: "admin_centre" },
        ],
        tags: {
          type: "boundary",
          boundary: "administrative",
          admin_level: "8",
          name: "Testilä",
          "name:sv": "Testby",
        },
      },
      {
        id: 20401883,
        members: [{ type: "way", ref: 21, role: "outer" }],
        tags: { type: "multipolygon", amenity: "pharmacy", name: "Lentoaseman apteekki" },
      },
    ],
  });
  const result = importPbf(path, {
    region: "fi",
    regionFilter: "boundary",
    municipalityAdminLevel: "8",
  });
  const built = buildPharmacies(result.features);

  it("reads the header replication timestamp", () => {
    expect(new Date(result.header.replicationTimestamp! * 1000).toISOString()).toBe(
      "2026-11-22T13:24:20.000Z",
    );
  });

  it("maps nodes, ways and relations with stable IDs and drops features outside the boundary", () => {
    expect(result.boundaryId).toBe("relation/1");
    expect(result.outsideRegion).toEqual(["node/103"]);
    expect(built.pharmacies.map((p) => p.id)).toEqual(["node/100", "relation/20401883", "way/31"]);
  });

  it("applies the duplicate rule by distance and by outline", () => {
    expect(built.dropped).toMatchObject([
      { id: "node/101", keptId: "node/100", reason: "within-50m", distanceMeters: 7.3 },
      { id: "node/102", keptId: "relation/20401883", reason: "inside-outline" },
    ]);
  });

  it("uses the bbox centre for distance and an interior pin for areas", () => {
    const way = built.pharmacies.find((p) => p.id === "way/31")!;
    expect({ lat: way.lat, lon: way.lon }).toEqual({ lat: 62.0911322, lon: 28.9199979 });
    expect(pointInArea(way.pin!, [enonkoski])).toBe(true);
    expect(way.address).toEqual({ city: "Enonkoski" });
    const relation = built.pharmacies.find((p) => p.id === "relation/20401883")!;
    expect({ lat: relation.lat, lon: relation.lon }).toEqual({ lat: 60.3178, lon: 24.965 });
    expect(relation.pin).toBeDefined();
    expect(built.pharmacies.find((p) => p.id === "node/100")!.pin).toBeUndefined();
  });

  it("builds the place index with municipalities", () => {
    expect(result.places).toEqual([
      {
        id: "node/104",
        name: "Tampere",
        nameSv: "Tammerfors",
        type: "city",
        lat: 61.5,
        lon: 23.76,
        municipality: "Testilä",
      },
      { id: "node/105", name: "Itäkylä", type: "village", lat: 62, lon: 28 },
      {
        id: "relation/2",
        name: "Testilä",
        nameSv: "Testby",
        type: "municipality",
        lat: 60.2,
        lon: 24.9,
      },
    ]);
  });

  it("produces identical bytes on a second run", () => {
    const again = buildPharmacies(
      importPbf(path, { region: "fi", regionFilter: "boundary", municipalityAdminLevel: "8" })
        .features,
    );
    expect(serializeSnapshot("fi", again.pharmacies)).toBe(
      serializeSnapshot("fi", built.pharmacies),
    );
    expect(readFileSync(path).length).toBeGreaterThan(0);
  });

  it("fails clearly when the region boundary is missing", () => {
    expect(() =>
      importPbf(path, { region: "se", regionFilter: "boundary", municipalityAdminLevel: "8" }),
    ).toThrow(/ISO3166-1=SE/);
  });
});
