import type { TimeRange } from "./openingHours";
import type { SupportedLocale } from "../../shared/i18n/locale";

/**
 * A clock time from the canonical "HH:MM" for display. English keeps "07:30". Finnish follows the
 * Institute for the Languages of Finland: a period separator and no leading zero, as in "7.30".
 */
export function formatClockTime(time: string, locale: SupportedLocale): string {
  if (locale !== "fi") return time;
  const [hours = "", minutes = ""] = time.split(":");
  return `${Number(hours)}.${minutes}`;
}

export function formatTimeRange(range: TimeRange, locale: SupportedLocale): string {
  return `${formatClockTime(range.start, locale)}–${formatClockTime(range.end, locale)}`;
}
