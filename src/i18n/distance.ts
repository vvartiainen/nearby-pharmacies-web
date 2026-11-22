import type { SupportedLocale } from "./locale";
import { interpolate, messagesFor } from "./messages";

export type DistanceBand = "near" | "medium" | "far";

/**
 * Round half-up to 10 m, 100 m, or 1 km. A value rounded up to a threshold
 * uses the next band for display. Ordering uses the original distance.
 */
export function formatDistance(meters: number, locale: SupportedLocale): string {
  const roundedMeters = roundToTenMeters(meters);
  if (roundedMeters < 1000) return unitFormat(locale, "meter", 0).format(roundedMeters);
  const tenths = Math.round(meters / 100) / 10;
  if (tenths < 10) return unitFormat(locale, "kilometer", 1).format(tenths);
  return unitFormat(locale, "kilometer", 0).format(Math.round(meters / 1000));
}

/** Use the displayed distance so results with the same label have the same color. */
export function distanceBand(meters: number): DistanceBand {
  const rounded = roundToTenMeters(meters);
  if (rounded < 500) return "near";
  if (rounded < 1000) return "medium";
  return "far";
}

function roundToTenMeters(meters: number): number {
  if (!Number.isFinite(meters) || meters < 0) throw new RangeError(`Invalid distance: ${meters}`);
  return Math.round(meters / 10) * 10;
}

/** The localized straight-line label, e.g. "300 m straight line" or "1,7 km linnuntietä". */
export function formatStraightLine(meters: number, locale: SupportedLocale): string {
  return interpolate(messagesFor(locale).straightLine, {
    distance: formatDistance(meters, locale),
  });
}

const formats = new Map<string, Intl.NumberFormat>();

function unitFormat(locale: SupportedLocale, unit: "meter" | "kilometer", digits: number) {
  const key = `${locale}:${unit}:${digits}`;
  let format = formats.get(key);
  if (!format) {
    format = new Intl.NumberFormat(locale, {
      style: "unit",
      unit,
      unitDisplay: "short",
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
    formats.set(key, format);
  }
  return format;
}
