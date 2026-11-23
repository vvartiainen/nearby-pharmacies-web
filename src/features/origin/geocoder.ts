import type { SupportedLocale } from "../../shared/i18n/locale";
import type { LatLon } from "../../shared/geo/haversine";

export interface PlaceMatch extends LatLon {
  readonly title: string;
  readonly context: string;
  readonly label: string;
}

interface OnlineGeocoderConfig {
  readonly provider: "nominatim" | "photon";
  readonly endpoint: string;
  readonly countryCode: string;
}
type GeocoderConfig = OnlineGeocoderConfig | { readonly provider: "local" };
type Fields = Record<string, unknown>;

const localConfig = { provider: "local" } as const;

function record(value: unknown): Fields {
  return value !== null && typeof value === "object" ? (value as Fields) : {};
}

function string(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function coordinate(value: unknown) {
  return typeof value === "number" || (typeof value === "string" && value.trim())
    ? Number(value)
    : NaN;
}

let configRequest: Promise<GeocoderConfig> | undefined;
export function loadGeocoderConfig(): Promise<GeocoderConfig> {
  configRequest ??= fetch(`${import.meta.env.BASE_URL}geocoder.json`, {
    cache: "no-cache",
    signal: AbortSignal.timeout(3000),
  })
    .then(async (response): Promise<GeocoderConfig> => {
      if (!response.ok) return localConfig;
      const { provider, endpoint, countryCode } = record(await response.json());
      if (
        (provider === "nominatim" || provider === "photon") &&
        typeof endpoint === "string" &&
        new URL(endpoint).protocol === "https:" &&
        typeof countryCode === "string" &&
        /^[a-z]{2}$/i.test(countryCode)
      ) {
        return { provider, endpoint, countryCode: countryCode.toLowerCase() };
      }
      return localConfig;
    })
    .catch(() => localConfig);
  return configRequest;
}

function searchUrl(config: OnlineGeocoderConfig, query: string, locale: SupportedLocale) {
  const url = new URL(config.endpoint);
  const { countryCode, provider } = config;
  const parameters =
    provider === "photon"
      ? { q: query, lang: locale, limit: "5", countrycode: countryCode.toUpperCase() }
      : {
          q: query,
          format: "jsonv2",
          addressdetails: "1",
          "accept-language": locale,
          countrycodes: countryCode,
          limit: "5",
        };
  for (const [key, value] of Object.entries(parameters)) url.searchParams.set(key, value);
  return url;
}

export function placeMatch(
  point: LatLon,
  title: string,
  contextParts: readonly string[],
): PlaceMatch {
  const context = [...new Set(contextParts.filter((part) => part && part !== title))].join(", ");
  return { ...point, title, context, label: context ? `${title} · ${context}` : title };
}

function readMatches(
  payload: unknown,
  { provider, countryCode }: OnlineGeocoderConfig,
  locale: SupportedLocale,
) {
  const nominatim = provider === "nominatim";
  const results = nominatim ? payload : record(payload).features;
  if (!Array.isArray(results)) throw new Error("Invalid geocoder response");
  const regionNames = new Intl.DisplayNames(locale, { type: "region" });
  const matches = new Map<string, PlaceMatch>();
  for (const result of results) {
    const entry = record(result);
    const address = record(nominatim ? entry.address : entry.properties);
    const code = string(address.country_code ?? address.countrycode).toLowerCase();
    if (code !== countryCode) continue;
    const coordinates = record(entry.geometry).coordinates;
    const [lon, lat] = (
      nominatim ? [entry.lon, entry.lat] : Array.isArray(coordinates) ? coordinates : []
    ).map(coordinate);
    if (
      lat === undefined ||
      lon === undefined ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lon) ||
      Math.abs(lat) > 90 ||
      Math.abs(lon) > 180
    )
      continue;

    const road = string(address.road ?? address.street);
    const number = string(address.housenumber ?? address.house_number);
    const street = road ? [road, number].filter(Boolean).join(" ") : "";
    const municipality =
      [address.city, address.town, address.municipality, address.village]
        .map(string)
        .find(Boolean) ?? "";
    const area =
      [
        address.neighbourhood,
        address.quarter,
        address.suburb,
        address.city_district,
        address.district,
        address.hamlet,
        address.village,
      ]
        .map(string)
        .find(Boolean) ?? "";
    const name = string(nominatim ? entry.name : address.name);
    const featureName = [road, street, municipality].includes(name) ? "" : name;
    const displayName = string(entry.display_name).split(",", 1)[0]?.trim();
    const title = featureName || street || area || displayName || municipality;
    if (!title) continue;
    const country = string(address.country) || (regionNames.of(code.toUpperCase()) ?? code);
    const match = placeMatch({ lat, lon }, title, [street, area, municipality, country]);
    if (!matches.has(match.label)) matches.set(match.label, match);
    if (matches.size === 5) break;
  }
  return [...matches.values()];
}

export interface Geocoder {
  search(
    query: string,
    locale: SupportedLocale,
    signal: AbortSignal,
  ): Promise<readonly PlaceMatch[]>;
}

/** The session cache avoids repeating requests. No retries or automatic queries. */
export function createGeocoder(): Geocoder {
  const cache = new Map<string, readonly PlaceMatch[]>();
  let lastRequest = -Infinity;
  let inFlight = false;

  return {
    async search(query, locale, signal) {
      const config = await loadGeocoderConfig();
      signal.throwIfAborted();
      if (config.provider === "local") return [];
      const cacheKey = `${locale}:${query.normalize("NFC").toLocaleLowerCase(locale)}`;
      const cached = cache.get(cacheKey);
      if (cached) return cached;
      const now = performance.now();
      if (inFlight || now - lastRequest < 1000) throw new Error("Search is rate-limited");
      inFlight = true;
      lastRequest = now;
      try {
        const response = await fetch(searchUrl(config, query, locale), {
          credentials: "omit",
          signal: AbortSignal.any([signal, AbortSignal.timeout(6000)]),
        });
        if (!response.ok) throw new Error("Search unavailable");
        const matches = readMatches(await response.json(), config, locale);
        if (cache.size >= 100) cache.delete(cache.keys().next().value!);
        cache.set(cacheKey, matches);
        return matches;
      } finally {
        inFlight = false;
      }
    },
  };
}
