import type { SupportedLocale } from "./locale";
import { interpolate, messagesFor } from "./messages";

/**
 * Display rounding from the design spec ("Distance format"): under 1 km to the nearest 10 m,
 * 1 km to under 10 km to the nearest 0.1 km, 10 km and over to the nearest 1 km. Rounding is
 * half-up on the unrounded distance. A value that rounds up to the next band's threshold is shown
 * in that band, so 995 m shows "1.0 km" (never "1,000 m") and 9.95 km shows "10 km" (never
 * "10.0 km"). Ordering never uses these rounded values.
 */
export function formatDistance(meters: number, locale: SupportedLocale): string {
  if (!Number.isFinite(meters) || meters < 0) throw new RangeError(`Invalid distance: ${meters}`);
  const roundedMeters = Math.round(meters / 10) * 10;
  if (roundedMeters < 1000) return unitFormat(locale, "meter", 0).format(roundedMeters);
  const tenths = Math.round(meters / 100) / 10;
  if (tenths < 10) return unitFormat(locale, "kilometer", 1).format(tenths);
  return unitFormat(locale, "kilometer", 0).format(Math.round(meters / 1000));
}

/** The localized row label, e.g. "300 m straight line" or "1,7 km linnuntietä". */
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
