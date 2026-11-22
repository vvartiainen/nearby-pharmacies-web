import type { Place, PlaceIndex } from "../../data/schema";
import type { SupportedLocale } from "../../shared/i18n/locale";
import { placeMatch, type PlaceMatch } from "./geocoder";

const normalize = (value: string) =>
  value.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").trim().replace(/\s+/g, " ");

function editDistance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 0; i < a.length; i++) {
    const row = [i + 1];
    for (let j = 0; j < b.length; j++) {
      row.push(Math.min(row[j]! + 1, previous[j + 1]! + 1, previous[j]! + Number(a[i] !== b[j])));
    }
    previous = row;
  }
  return previous[b.length]!;
}

export function matchLocalPlaces(
  query: string,
  locale: SupportedLocale,
  places: readonly Place[],
): PlaceMatch[] {
  // A submitted street number is not a request to substitute a city.
  const normalized = normalize(query);
  if (!normalized || /[\d,]/.test(normalized) || normalized.length > 60) return [];
  const country = locale === "fi" ? "Suomi" : "Finland";
  const tolerance = normalized.length >= 8 ? 2 : normalized.length >= 5 ? 1 : 0;
  const matches = places
    .flatMap((place) => {
      const score = Math.min(
        ...[place.name, place.nameSv]
          .filter((name): name is string => !!name)
          .map((name) => {
            const candidate = normalize(name);
            return Math.abs(candidate.length - normalized.length) > tolerance
              ? Infinity
              : editDistance(normalized, candidate);
          }),
      );
      return score <= tolerance ? [{ place, score }] : [];
    })
    .toSorted(
      (a, b) =>
        a.score - b.score ||
        Number(b.place.type === "municipality") - Number(a.place.type === "municipality"),
    );
  const unique = new Map<string, PlaceMatch>();
  for (const { place } of matches) {
    const match = placeMatch({ lat: place.lat, lon: place.lon }, place.name, [
      place.municipality ?? "",
      country,
    ]);
    if (!unique.has(match.label)) unique.set(match.label, match);
    if (unique.size === 5) break;
  }
  return [...unique.values()];
}

const imports = import.meta.glob<PlaceIndex>("../../data/places.fi.json", { import: "default" });
let localIndex: Promise<PlaceIndex | undefined> | undefined;

/** Fetch the local chunk on launch so search can use it if connectivity drops later. */
export function loadLocalPlaces() {
  localIndex ??=
    imports["../../data/places.fi.json"]?.().catch(() => undefined) ?? Promise.resolve(undefined);
  return localIndex;
}

export async function searchLocalPlaces(
  query: string,
  locale: SupportedLocale,
): Promise<PlaceMatch[]> {
  const index = await loadLocalPlaces();
  return index ? matchLocalPlaces(query, locale, index.places) : [];
}
