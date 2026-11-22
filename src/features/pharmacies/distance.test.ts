import { describe, expect, it } from "vitest";
import { distanceBand, formatDistance, formatStraightLine } from "./distance";

// Intl may separate number and unit with a no-break space; normalise it for readable expectations.
const normalize = (text: string) => text.replace(/[  ]/g, " ");
const format = (meters: number, locale: "en" | "fi") => normalize(formatDistance(meters, locale));

describe("formatDistance", () => {
  it.each([
    { meters: 0, en: "0 m", fi: "0 m" },
    { meters: 50.4, en: "50 m", fi: "50 m" },
    { meters: 295.96, en: "300 m", fi: "300 m" },
    { meters: 296.05, en: "300 m", fi: "300 m" },
    { meters: 994.9, en: "990 m", fi: "990 m" },
    { meters: 995, en: "1.0 km", fi: "1,0 km" },
    { meters: 999.9, en: "1.0 km", fi: "1,0 km" },
    { meters: 1000, en: "1.0 km", fi: "1,0 km" },
    { meters: 1749, en: "1.7 km", fi: "1,7 km" },
    { meters: 9949.9, en: "9.9 km", fi: "9,9 km" },
    { meters: 9950, en: "10 km", fi: "10 km" },
    { meters: 10_000, en: "10 km", fi: "10 km" },
    { meters: 140_534.6, en: "141 km", fi: "141 km" },
    { meters: 1_234_000, en: "1,234 km", fi: "1 234 km" },
  ])("formats $meters m as $en and $fi", ({ meters, en, fi }) => {
    expect(format(meters, "en")).toBe(en);
    expect(format(meters, "fi")).toBe(fi);
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])("rejects %s", (meters) => {
    expect(() => formatDistance(meters, "en")).toThrow(RangeError);
  });
});

describe("formatStraightLine", () => {
  it("uses the localized straight-line message", () => {
    expect(normalize(formatStraightLine(1700, "en"))).toBe("1.7 km straight line");
    expect(normalize(formatStraightLine(1700, "fi"))).toBe("1,7 km linnuntietä");
  });
});

describe("distanceBand", () => {
  it.each([
    { meters: 494.9, band: "near" },
    { meters: 495, band: "medium" },
    { meters: 994.9, band: "medium" },
    { meters: 995, band: "far" },
  ])("uses the displayed distance to color $meters m as $band", ({ meters, band }) => {
    expect(distanceBand(meters)).toBe(band);
  });
});
