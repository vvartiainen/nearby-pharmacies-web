import { useCallback, useMemo, useReducer, useRef } from "react";
import { addressLines, displayName } from "./app/format";
import { appReducer, initialState, nearestPharmacies, pinPosition } from "./app/state";
import { useMediaQuery } from "./app/useMediaQuery";
import { DetailsCard } from "./components/DetailsCard";
import { PharmacyDetails } from "./components/PharmacyDetails";
import { ResultRow } from "./components/ResultRow";
import { pharmacySnapshot } from "./data";
import { distanceBand, formatDistance, formatStraightLine } from "./i18n/distance";
import type { SupportedLocale } from "./i18n/locale";
import { interpolate, messagesFor } from "./i18n/messages";
import { tileSettings } from "./map/config";
import { PharmacyMap, type MapPin, type ObscuredEdges } from "./map/PharmacyMap";

/** Same breakpoint as the desktop layout in styles.css. */
const desktopQuery = "(min-width: 900px)";

export function App({ locale }: { locale: SupportedLocale }) {
  const messages = messagesFor(locale);
  const [state, dispatch] = useReducer(appReducer, initialState);
  const isDesktop = useMediaQuery(desktopQuery);
  const sheetRef = useRef<HTMLElement>(null);
  const cardRef = useRef<HTMLElement>(null);

  // Results depend on the origin only; selection and panning never rerank.
  const results = useMemo(
    () =>
      nearestPharmacies(state.origin, pharmacySnapshot.pharmacies).map(
        ({ pharmacy, distanceMeters }) => ({
          pharmacy,
          name: displayName(pharmacy, messages),
          distance: formatDistance(distanceMeters, locale),
          band: distanceBand(distanceMeters),
          straightLine: formatStraightLine(distanceMeters, locale),
        }),
      ),
    [state.origin, messages, locale],
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

  const select = useCallback((id: string) => dispatch({ type: "select", id, source: "row" }), []);
  const selectPin = useCallback(
    (id: string) => dispatch({ type: "select", id, source: "pin" }),
    [],
  );
  const backToResults = useCallback(() => dispatch({ type: "backToResults" }), []);
  // The card sits in the map area, so its right edge is the width it covers from the map's left.
  const obscured = useCallback(
    (): ObscuredEdges =>
      isDesktop
        ? {
            left: cardRef.current ? cardRef.current.offsetLeft + cardRef.current.offsetWidth : 0,
            bottom: 0,
          }
        : { left: 0, bottom: sheetRef.current?.offsetHeight ?? 0 },
    [isDesktop],
  );

  const selected = results.find((row) => row.pharmacy.id === state.selectedId);
  const showDetails = state.view === "details" && selected !== undefined;
  const sheetShowsDetails = showDetails && !isDesktop;
  const sheetExpanded = state.sheet === "expanded";
  const showSheetBack = sheetShowsDetails && sheetExpanded;
  const sheetToggleLabel = sheetShowsDetails ? messages.detailsLabel : messages.results;
  const originLabel = messages.defaultOrigin;
  const count = new Intl.NumberFormat(locale).format(pharmacySnapshot.pharmacies.length);

  return (
    <main className="app" data-layout={isDesktop ? "desktop" : "narrow"}>
      <header className="origin-bar">
        <h1 className="app-title">{messages.title}</h1>
        <div className="origin" data-testid="origin">
          <p className="origin__caption">{messages.originCaption}</p>
          <p className="origin__label">
            <span className="origin__dot" aria-hidden="true" />
            {originLabel}
          </p>
        </div>
      </header>

      <section
        ref={sheetRef}
        className="results"
        data-sheet={isDesktop ? undefined : state.sheet}
        data-view={sheetShowsDetails ? "details" : undefined}
        aria-label={messages.resultsTitle}
      >
        {isDesktop ? (
          <div className="results__header">
            <h2 className="results__title">{messages.resultsTitle}</h2>
            <p className="results__scope">{interpolate(messages.scopeAndCount, { count })}</p>
          </div>
        ) : (
          <div className="results__toolbar">
            {showSheetBack ? (
              <button type="button" className="back-button" onClick={backToResults}>
                <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
                  <path d="M10 3 5 8l5 5" fill="none" stroke="currentColor" strokeWidth="2" />
                </svg>
                {messages.backToResults}
              </button>
            ) : null}
            <button
              type="button"
              className="sheet-toggle"
              aria-label={sheetToggleLabel}
              aria-expanded={sheetExpanded}
              aria-controls="results-content"
              onClick={() => dispatch({ type: "toggleSheet" })}
            >
              {!showSheetBack ? sheetToggleLabel : null}
              <svg className="sheet-toggle__chevron" viewBox="0 0 16 16" aria-hidden="true">
                <path d="m3 10 5-5 5 5" fill="none" stroke="currentColor" strokeWidth="2" />
              </svg>
            </button>
          </div>
        )}

        <div
          key={sheetShowsDetails ? `details-${state.selectionCount}` : "list"}
          id="results-content"
          className="results__content"
          hidden={!isDesktop && !sheetExpanded}
        >
          {sheetExpanded && sheetShowsDetails ? (
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
          ) : isDesktop || sheetExpanded ? (
            <ol className="results__list">
              {results.map(({ pharmacy, name, distance, band }) => {
                const isSelected = pharmacy.id === state.selectedId;
                return (
                  <ResultRow
                    key={pharmacy.id}
                    id={pharmacy.id}
                    name={name}
                    distance={distance}
                    distanceBand={band}
                    selected={isSelected}
                    reveal={isSelected}
                    focus={isSelected && state.restoreRowFocus}
                    onSelect={select}
                  />
                );
              })}
            </ol>
          ) : null}
        </div>
      </section>

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
        />
        {showDetails && isDesktop ? (
          <DetailsCard
            ref={cardRef}
            messages={messages}
            onClose={backToResults}
            selectionKey={state.selectionCount}
          >
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
          </DetailsCard>
        ) : null}
      </div>
    </main>
  );
}
