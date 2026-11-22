import en from "./en.json";
import fi from "./fi.json";
import type { SupportedLocale } from "./locale";

export type Messages = typeof en;

const catalogs: Record<SupportedLocale, Messages> = { en, fi };

export function messagesFor(locale: SupportedLocale): Messages {
  return catalogs[locale];
}

export function interpolate(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);
}
