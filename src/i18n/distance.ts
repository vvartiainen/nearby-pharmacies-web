import type { SupportedLocale } from "./locale";

/** Formats a distance in kilometres with one decimal for the given locale, e.g. "0.4 km" or "0,4 km". */
export function formatKilometres(kilometres: number, locale: SupportedLocale): string {
  return new Intl.NumberFormat(locale, {
    style: "unit",
    unit: "kilometer",
    unitDisplay: "short",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(kilometres);
}
