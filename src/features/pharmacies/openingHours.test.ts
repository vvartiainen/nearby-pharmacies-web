import { describe, expect, it } from "vitest";
import { pharmacySnapshot } from "../../data";
import { interpretOpeningHours, type InterpretedHours } from "./openingHours";

function lines(result: InterpretedHours): string[] | string {
  if (result.kind === "raw") return `raw: ${result.text}`;
  const codes = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
  return result.days.map(
    (ranges, index) =>
      `${codes[index]} ${ranges.map((r) => `${r.start}-${r.end}`).join(",") || "closed"}`,
  );
}

const week = (...days: string[]) =>
  days.map((value, index) => `${"MoTuWeThFrSaSu".slice(index * 2, index * 2 + 2)} ${value}`);

describe("interpretOpeningHours", () => {
  it.each([
    {
      value: "Mo-Fr 08:00-20:00; Sa 10:00-16:00; Su off",
      expected: week(
        "08:00-20:00",
        "08:00-20:00",
        "08:00-20:00",
        "08:00-20:00",
        "08:00-20:00",
        "10:00-16:00",
        "closed",
      ),
    },
    {
      value: "Mo-Fr 08:00-20:00; Sa 11:00-17:00",
      expected: week(
        "08:00-20:00",
        "08:00-20:00",
        "08:00-20:00",
        "08:00-20:00",
        "08:00-20:00",
        "11:00-17:00",
        "closed",
      ),
    },
    { value: "Mo-Su 08:00-22:00", expected: week(...Array<string>(7).fill("08:00-22:00")) },
    { value: "08:00-24:00", expected: week(...Array<string>(7).fill("08:00-24:00")) },
    { value: "24/7", expected: week(...Array<string>(7).fill("00:00-24:00")) },
    {
      value: "Mo,We 09:00-13:00",
      expected: week(
        "09:00-13:00",
        "closed",
        "09:00-13:00",
        "closed",
        "closed",
        "closed",
        "closed",
      ),
    },
    {
      value: "Mo-We, Fr 09:00-16:00; Th 09:00-17:00",
      expected: week(
        "09:00-16:00",
        "09:00-16:00",
        "09:00-16:00",
        "09:00-17:00",
        "09:00-16:00",
        "closed",
        "closed",
      ),
    },
    {
      value: "Mo-Tu,Th-Fr 09:00-12:00,12:30-16:00",
      expected: week(
        "09:00-12:00,12:30-16:00",
        "09:00-12:00,12:30-16:00",
        "closed",
        "09:00-12:00,12:30-16:00",
        "09:00-12:00,12:30-16:00",
        "closed",
        "closed",
      ),
    },
    {
      value: "Mo-Fr 09:00-19:00, Sa 09:00-15:00",
      expected: week(
        "09:00-19:00",
        "09:00-19:00",
        "09:00-19:00",
        "09:00-19:00",
        "09:00-19:00",
        "09:00-15:00",
        "closed",
      ),
    },
    {
      value: "Mo-Fr 09:00-16:30; We off",
      expected: week(
        "09:00-16:30",
        "09:00-16:30",
        "closed",
        "09:00-16:30",
        "09:00-16:30",
        "closed",
        "closed",
      ),
    },
    {
      value: "Mo-Fr 08:00-21:00; Sa 09:00-19:00; Su,PH 10:00-18:00; PH off",
      expected: week(
        "08:00-21:00",
        "08:00-21:00",
        "08:00-21:00",
        "08:00-21:00",
        "08:00-21:00",
        "09:00-19:00",
        "10:00-18:00",
      ),
    },
    {
      value: "Su-Fr 09:00-17:00; Sa 09:00-14:00",
      expected: week(...Array<string>(5).fill("09:00-17:00"), "09:00-14:00", "09:00-17:00"),
    },
    {
      value: "Mo-Sa 09:00-18:00, Sa,Su 09:00-15:00",
      expected: week(...Array<string>(6).fill("09:00-18:00"), "09:00-15:00"),
    },
    {
      value: "Mo-Fr 9:00-17:00; Sa-Su closed",
      expected: week(...Array<string>(5).fill("09:00-17:00"), "closed", "closed"),
    },
    {
      value: "Mo-Th 09:00-17:00; Fr 09:00-18:00; Sa  09:00-16:00",
      expected: week(
        ...Array<string>(4).fill("09:00-17:00"),
        "09:00-18:00",
        "09:00-16:00",
        "closed",
      ),
    },
  ])("interprets $value", ({ value, expected }) => {
    expect(lines(interpretOpeningHours(value))).toEqual(expected);
  });

  it.each([
    "Mo-Fr 09:00-18:00; Jun-Aug 09:00-17:00",
    "week 01-53/2 Mo-Fr 09:00-19:00; week 02-52/2 Mo-Fr 09:00-21:00",
    'Mo-Fr 08:00-18:00; Sa 09:00-15:00; Su 11:00-16:00 || "parillisina viikkoina"',
    "Mo-Th 09:00-17:00; Su,PH off; Jun 21,Dec 24 09:00-12:00",
    "Mo-Fr",
    "Mo-Fr 09:00-25:00",
    "Mo-Fr 09:00-09:00",
    "Mo-Fr 09:00-17:00 off",
    "PH off",
    "by appointment",
    "",
  ])("keeps %j as raw text", (value) => {
    expect(interpretOpeningHours(value)).toEqual({ kind: "raw", text: value });
  });

  it("interprets most of the bundled snapshot and never throws", () => {
    const values = pharmacySnapshot.pharmacies.flatMap((p) =>
      p.openingHours ? [p.openingHours] : [],
    );
    const weekly = values.filter((value) => interpretOpeningHours(value).kind === "weekly");
    expect(weekly.length / values.length).toBeGreaterThan(0.95);
  });
});
