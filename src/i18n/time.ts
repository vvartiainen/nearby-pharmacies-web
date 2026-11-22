import type { TimeRange } from "../hours/openingHours";
import type { SupportedLocale } from "./locale";

/**
 * A clock time from the canonical "HH:MM" for display. English keeps "07:30". Finnish follows the
 * Institute for the Languages of Finland: a period separator and no leading zero, as in "7.30".
 */
export function formatClockTime(time: string, locale: SupportedLocale): string {
  if (locale !== "fi") return time;
  const [hours = "", minutes = ""] = time.split(":");
  return `${Number(hours)}.${minutes}`;
}

/** "07:30–18:00" in English, "7.30–18.00" in Finnish. */
export function formatTimeRange(range: TimeRange, locale: SupportedLocale): string {
  return `${formatClockTime(range.start, locale)}–${formatClockTime(range.end, locale)}`;
}
