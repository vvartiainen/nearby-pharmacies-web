import { useEffect, useRef, useState } from "react";
import type { Origin } from "./origin";
import type { SupportedLocale } from "../../shared/i18n/locale";
import type { LatLon } from "../../shared/geo/haversine";
import { createGeocoder, loadGeocoderConfig, type PlaceMatch } from "./geocoder";
import { loadLocalPlaces, searchLocalPlaces } from "./localPlaces";

type SearchState =
  | { kind: "idle" | "pending" }
  | { kind: "matches"; matches: readonly PlaceMatch[]; local: boolean }
  | { kind: "empty"; query: string }
  | { kind: "unavailable" };
type LocationState = "idle" | "pending" | "denied" | "timeout" | "unavailable";

const promptKey = "nearby-pharmacies-location-prompt-dismissed";

function shouldOfferLocation() {
  try {
    return sessionStorage.getItem(promptKey) !== "1";
  } catch {
    return true;
  }
}

/** Only the active operation may publish a result. Changing the origin invalidates both requests. */
export function useOriginControls(locale: SupportedLocale, applyOrigin: (origin: Origin) => void) {
  const [geocoder] = useState(createGeocoder);
  const [provider, setProvider] =
    useState<Awaited<ReturnType<typeof loadGeocoderConfig>>["provider"]>();
  const [search, setSearch] = useState<SearchState>({ kind: "idle" });
  const [location, setLocation] = useState<LocationState>("idle");
  const [offerLocation, setOfferLocation] = useState(shouldOfferLocation);
  const searchRequest = useRef<AbortController | null>(null);
  const locationRequest = useRef<object | null>(null);

  useEffect(() => {
    let active = true;
    void loadLocalPlaces();
    void loadGeocoderConfig().then((config) => {
      if (active) setProvider(config.provider);
    });
    return () => {
      active = false;
      searchRequest.current?.abort();
      locationRequest.current = null;
    };
  }, []);

  function dismissLocationOffer() {
    setOfferLocation(false);
    try {
      sessionStorage.setItem(promptKey, "1");
    } catch {
      // The in-memory dismissal still works when storage is disabled.
    }
  }

  function cancelSearch() {
    searchRequest.current?.abort();
    searchRequest.current = null;
    setSearch({ kind: "idle" });
  }

  function changeOrigin(origin: Origin) {
    cancelSearch();
    locationRequest.current = null;
    setLocation("idle");
    dismissLocationOffer();
    applyOrigin(origin);
  }

  async function submitSearch(text: string) {
    const query = text.trim().replace(/\s+/g, " ");
    if (!query || searchRequest.current) return;
    const request = new AbortController();
    searchRequest.current = request;
    setSearch({ kind: "pending" });
    dismissLocationOffer();
    const localMatches = searchLocalPlaces(query, locale).catch(() => []);
    try {
      let unavailable = false;
      try {
        const matches = await geocoder.search(query, locale, request.signal);
        if (searchRequest.current !== request) return;
        if (matches.length) {
          setSearch({ kind: "matches", matches, local: false });
          return;
        }
      } catch {
        unavailable = true;
      }
      const matches = await localMatches;
      if (searchRequest.current !== request) return;
      setSearch(
        matches.length
          ? { kind: "matches", matches, local: true }
          : unavailable
            ? { kind: "unavailable" }
            : { kind: "empty", query },
      );
    } finally {
      if (searchRequest.current === request) searchRequest.current = null;
    }
  }

  function placePin(point: LatLon) {
    changeOrigin({ ...point, kind: "pin" });
  }

  function requestLocation() {
    if (locationRequest.current) return;
    dismissLocationOffer();
    if (!navigator.geolocation) {
      setLocation("unavailable");
      return;
    }
    const request = {};
    locationRequest.current = request;
    setLocation("pending");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        if (locationRequest.current !== request) return;
        changeOrigin({ kind: "device", lat: coords.latitude, lon: coords.longitude });
      },
      (error) => {
        if (locationRequest.current !== request) return;
        locationRequest.current = null;
        setLocation(error.code === 1 ? "denied" : error.code === 3 ? "timeout" : "unavailable");
      },
      { timeout: 10_000, maximumAge: 0 },
    );
  }

  return {
    provider,
    search,
    location,
    offerLocation,
    dismissLocationOffer,
    requestLocation,
    submitSearch,
    cancelSearch,
    changeOrigin,
    placePin,
  };
}
