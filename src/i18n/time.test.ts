import { describe, expect, it } from "vitest";
import { formatClockTime, formatTimeRange } from "./time";

describe("formatClockTime", () => {
  it.each([
    ["07:30", "07:30", "7.30"],
    ["18:00", "18:00", "18.00"],
    ["00:00", "00:00", "0.00"],
    ["24:00", "24:00", "24.00"],
    ["09:05", "09:05", "9.05"],
  ])("formats %s", (time, en, fi) => {
    expect(formatClockTime(time, "en")).toBe(en);
    expect(formatClockTime(time, "fi")).toBe(fi);
  });
});

describe("formatTimeRange", () => {
  it("joins the ends with an en dash", () => {
    const range = { start: "07:30", end: "18:00" };
    expect(formatTimeRange(range, "en")).toBe("07:30–18:00");
    expect(formatTimeRange(range, "fi")).toBe("7.30–18.00");
  });
});
