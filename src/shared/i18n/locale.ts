export const supportedLocales = ["en", "fi"] as const;
export type SupportedLocale = (typeof supportedLocales)[number];
export const fallbackLocale: SupportedLocale = "en";

function isSupported(language: string): language is SupportedLocale {
  return (supportedLocales as readonly string[]).includes(language);
}

export function resolveLocale(preferred: readonly string[]): SupportedLocale {
  for (const tag of preferred) {
    let language: string;
    try {
      language = new Intl.Locale(tag).language;
    } catch {
      continue;
    }
    if (isSupported(language)) return language;
  }
  return fallbackLocale;
}

export function browserPreferences(nav: Pick<Navigator, "languages" | "language">): string[] {
  if (nav.languages?.length) return [...nav.languages];
  return nav.language ? [nav.language] : [];
}
