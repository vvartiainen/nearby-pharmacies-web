import { describe, expect, it } from "vitest";
import en from "../locales/en.json";
import fi from "../locales/fi.json";
import { browserPreferences, resolveLocale } from "./locale";

describe("resolveLocale", () => {
  it.each([
    { preferred: ["fi-FI", "en-US"], expected: "fi" },
    { preferred: ["en-GB", "fi"], expected: "en" },
    { preferred: ["sv-SE", "fi-FI", "en"], expected: "fi" },
    { preferred: ["sv-SE", "de-DE"], expected: "en" },
    { preferred: ["FI"], expected: "fi" },
    { preferred: ["not a tag", "fi"], expected: "fi" },
    { preferred: [], expected: "en" },
  ])("picks $expected from $preferred", ({ preferred, expected }) => {
    expect(resolveLocale(preferred)).toBe(expected);
  });
});

describe("browserPreferences", () => {
  it("prefers navigator.languages", () => {
    expect(browserPreferences({ languages: ["sv-SE", "fi"], language: "sv-SE" })).toEqual([
      "sv-SE",
      "fi",
    ]);
  });

  it("falls back to navigator.language", () => {
    expect(browserPreferences({ languages: [], language: "fi-FI" })).toEqual(["fi-FI"]);
  });
});

describe("message resources", () => {
  it("define the same keys in Finnish and English", () => {
    expect(Object.keys(fi).toSorted()).toEqual(Object.keys(en).toSorted());
  });
});
