import { describe, expect, it } from "vitest";
import { formatKilometres } from "./distance";

// Intl may separate number and unit with a no-break space; normalise it for readable expectations.
const format = (kilometres: number, locale: "en" | "fi") =>
  formatKilometres(kilometres, locale).replace(/ /g, " ");

describe("formatKilometres", () => {
  it.each([
    { kilometres: 0.4, locale: "en", expected: "0.4 km" },
    { kilometres: 0.4, locale: "fi", expected: "0,4 km" },
    { kilometres: 0, locale: "fi", expected: "0,0 km" },
    { kilometres: 2.44, locale: "en", expected: "2.4 km" },
    { kilometres: 12.36, locale: "fi", expected: "12,4 km" },
  ] as const)("formats $kilometres km in $locale", ({ kilometres, locale, expected }) => {
    expect(format(kilometres, locale)).toBe(expected);
  });
});
