import { describe, expect, it } from "vitest";
import fixture from "../../../fixtures/ranking/ranking-v1.json";
import { formatDistance, formatStraightLine } from "./distance";
import { EARTH_MEAN_RADIUS_METERS, haversineMeters } from "../../shared/geo/haversine";
import { compareIds, rankPharmacies } from "./rank";

// Formatters differ in which space they put before the unit or between digit groups.
const normalizeSpaces = (text: string) => text.replace(/[  ]/g, " ");
const locales = ["en", "fi"] as const;

describe("shared ranking fixture", () => {
  it("uses the same Earth radius as the fixture", () => {
    expect(EARTH_MEAN_RADIUS_METERS).toBe(fixture.contract.earthRadiusMeters);
  });

  describe.each(fixture.origins)("from $name", (origin) => {
    const ranked = rankPharmacies(origin, fixture.pharmacies);

    it("returns every pharmacy in the expected order", () => {
      expect(ranked.map((row) => row.pharmacy.id)).toEqual(origin.expected.map((row) => row.id));
    });

    it("matches the independently computed distances", () => {
      ranked.forEach((row, index) => {
        const expected = origin.expected[index]!.distanceMeters;
        expect(Math.abs(row.distanceMeters - expected)).toBeLessThanOrEqual(
          fixture.distanceToleranceMeters,
        );
      });
    });

    it.each(locales)("shows the expected %s labels", (locale) => {
      expect(
        ranked.map((row) => normalizeSpaces(formatStraightLine(row.distanceMeters, locale))),
      ).toEqual(origin.expected.map((row) => row.label[locale]));
    });
  });

  it.each(fixture.displayCases)("formats $meters m as $en / $fi", ({ meters, en, fi }) => {
    expect(normalizeSpaces(formatDistance(meters, "en"))).toBe(en);
    expect(normalizeSpaces(formatDistance(meters, "fi"))).toBe(fi);
  });
});

describe("rankPharmacies", () => {
  const origin = { lat: 61, lon: 25 };

  it("gives zero distance for a pharmacy at the origin", () => {
    const [first] = rankPharmacies(origin, [{ id: "node/7", lat: 61, lon: 25 }]);
    expect(first?.distanceMeters).toBe(0);
    expect(formatStraightLine(0, "fi").replace(/ /g, " ")).toBe("0 m linnuntietä");
  });

  it("breaks exact ties by id in code-unit order, not numerically", () => {
    const east = { lat: 61, lon: 25.0078125 };
    const west = { lat: 61, lon: 24.9921875 };
    expect(haversineMeters(origin, east)).toBe(haversineMeters(origin, west));
    const ranked = rankPharmacies(origin, [
      { id: "way/3", ...east },
      { id: "node/9", ...east },
      { id: "node/10", ...west },
    ]);
    expect(ranked.map((row) => row.pharmacy.id)).toEqual(["node/10", "node/9", "way/3"]);
  });

  it("orders by unrounded distance when labels are equal", () => {
    const station = fixture.origins[0]!;
    const ranked = rankPharmacies(
      station,
      fixture.pharmacies.filter((p) => p.id === "node/4727972444" || p.id === "node/1369465698"),
    );
    expect(ranked.map((row) => row.pharmacy.id)).toEqual(["node/1369465698", "node/4727972444"]);
    expect(ranked[0]!.distanceMeters).toBeLessThan(ranked[1]!.distanceMeters);
    expect(new Set(ranked.map((row) => formatDistance(row.distanceMeters, "en")))).toEqual(
      new Set(["300 m"]),
    );
  });

  it("ranks records with missing name, address and hours like any other", () => {
    const ranked = rankPharmacies(origin, fixture.pharmacies);
    const unnamed = ranked.find((row) => row.pharmacy.id === "node/7")!;
    expect(unnamed.pharmacy).not.toHaveProperty("name");
    expect(unnamed.pharmacy).not.toHaveProperty("address");
    expect(unnamed.pharmacy).not.toHaveProperty("openingHours");
    expect(ranked[0]).toBe(unnamed);
  });

  it("does not reorder the input and handles an empty list", () => {
    const input = [...fixture.pharmacies];
    rankPharmacies(origin, input);
    expect(input).toEqual(fixture.pharmacies);
    expect(rankPharmacies(origin, [])).toEqual([]);
  });
});

describe("compareIds", () => {
  it.each([
    ["node/10", "node/9", -1],
    ["node/9", "node/9", 0],
    ["relation/1", "node/1", 1],
    ["node/1", "way/1", -1],
  ] as const)("compares %s with %s", (a, b, expected) => {
    expect(Math.sign(compareIds(a, b))).toBe(expected);
  });
});
