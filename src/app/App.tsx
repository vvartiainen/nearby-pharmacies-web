import { useMemo, useReducer, useRef } from "react";
import { pharmacySnapshot } from "../data";
import { PharmacyMap, type MapPin, type ObscuredEdges } from "../features/map/PharmacyMap";
import { tileSettings } from "../features/map/config";
import { OriginBar } from "../features/origin/OriginBar";
import { originCoverage } from "../features/origin/coverage";
import type { Origin } from "../features/origin/origin";
import { useOriginControls } from "../features/origin/useOriginControls";
import { DetailsCard } from "../features/pharmacies/DetailsCard";
import { PharmacyDetails } from "../features/pharmacies/PharmacyDetails";
import { ResultsPanel } from "../features/pharmacies/ResultsPanel";
import { addressLines } from "../features/pharmacies/format";
import { pharmacyResults, pinPosition } from "../features/pharmacies/results";
import type { SupportedLocale } from "../shared/i18n/locale";
import { messagesFor } from "../shared/i18n/messages";
import { appReducer, initialState } from "./state";
import { useMediaQuery } from "./useMediaQuery";

/** Same breakpoint as the desktop layout in layout.css. */
const desktopQuery = "(min-width: 900px)";

export function App({ locale }: { locale: SupportedLocale }) {
  const messages = messagesFor(locale);
  const [state, dispatch] = useReducer(appReducer, initialState);
  const isDesktop = useMediaQuery(desktopQuery);
  const sheetRef = useRef<HTMLElement>(null);
  const cardRef = useRef<HTMLElement>(null);

  const applyOrigin = (origin: Origin) => dispatch({ type: "setOrigin", origin });
  const controls = useOriginControls(locale, applyOrigin);
  const coverage = useMemo(() => originCoverage(state.origin), [state.origin]);

  // Stable pins keep Leaflet from rebuilding markers and refitting the map on selection.
  const results = useMemo(
    () => pharmacyResults(state.origin, pharmacySnapshot.pharmacies, locale, messages),
    [state.origin, locale, messages],
  );
  const pins = useMemo<MapPin[]>(
    () =>
      results.map(({ pharmacy, name, straightLine }) => ({
        id: pharmacy.id,
        label: `${name}, ${straightLine}`,
        position: pinPosition(pharmacy),
      })),
    [results],
  );

  const select = (id: string) => dispatch({ type: "select", id, source: "row" });
  const selectPin = (id: string) => dispatch({ type: "select", id, source: "pin" });
  const backToResults = () => dispatch({ type: "backToResults" });
  // The card sits in the map area, so its right edge is the width it covers from the map's left.
  const obscured = (): ObscuredEdges =>
    isDesktop
      ? {
          left: cardRef.current ? cardRef.current.offsetLeft + cardRef.current.offsetWidth : 0,
          bottom: 0,
        }
      : { left: 0, bottom: sheetRef.current?.offsetHeight ?? 0 };

  const selected = results.find((row) => row.pharmacy.id === state.selectedId);
  const details =
    state.view === "details" && selected ? (
      <PharmacyDetails
        key={state.selectionCount}
        name={selected.name}
        distance={selected.straightLine}
        address={addressLines(selected.pharmacy)}
        openingHours={selected.pharmacy.openingHours}
        messages={messages}
        locale={locale}
        focusOnMount={state.selectionSource === "row"}
      />
    ) : undefined;
  const originLabel =
    state.origin.kind === "search"
      ? state.origin.label
      : state.origin.kind === "device"
        ? messages.deviceOrigin
        : state.origin.kind === "pin"
          ? messages.pinOrigin
          : messages.defaultOrigin;
  const count = new Intl.NumberFormat(locale).format(pharmacySnapshot.pharmacies.length);

  return (
    <main className="app" data-layout={isDesktop ? "desktop" : "narrow"}>
      <OriginBar
        controls={controls}
        coverage={coverage}
        messages={messages}
        origin={state.origin}
        originLabel={originLabel}
        count={count}
      />

      <ResultsPanel
        ref={sheetRef}
        isDesktop={isDesktop}
        messages={messages}
        results={results}
        selectedId={state.selectedId}
        selectionCount={state.selectionCount}
        restoreRowFocus={state.restoreRowFocus}
        sheet={state.sheet}
        details={details}
        onSelect={select}
        onBackToResults={backToResults}
        onToggleSheet={() => dispatch({ type: "toggleSheet" })}
      />

      <div className="map-area">
        <PharmacyMap
          origin={state.origin}
          label={messages.mapLabel}
          originLabel={originLabel}
          pins={pins}
          selectedId={state.selectedId}
          selectionCount={state.selectionCount}
          attribution={tileSettings.attributionText ?? messages.mapAttribution}
          attributionPosition={isDesktop ? "bottomright" : "topright"}
          zoomPosition={isDesktop ? "topright" : "topleft"}
          obscured={obscured}
          onSelect={selectPin}
          onPlaceOrigin={controls.placePin}
          chooseOnMap={messages.chooseOnMap}
          searchFromHere={messages.searchFromHere}
          cancel={messages.cancelMapPick}
          keepViewport={state.origin.kind === "pin" && coverage !== "outside"}
        />
        {details && isDesktop ? (
          <DetailsCard
            ref={cardRef}
            messages={messages}
            onClose={backToResults}
            selectionKey={state.selectionCount}
          >
            {details}
          </DetailsCard>
        ) : null}
      </div>
    </main>
  );
}
