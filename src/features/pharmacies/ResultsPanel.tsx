import type { ReactElement, Ref } from "react";
import { interpolate, type Messages } from "../../shared/i18n/messages";
import { ResultRow } from "./ResultRow";
import type { PharmacyResult } from "./results";

interface ResultsPanelProps {
  readonly ref: Ref<HTMLElement>;
  readonly isDesktop: boolean;
  readonly messages: Messages;
  readonly results: readonly PharmacyResult[];
  readonly selectedId: string | null;
  readonly selectionCount: number;
  readonly restoreRowFocus: boolean;
  readonly sheet: "peek" | "expanded";
  readonly details: ReactElement | undefined;
  readonly onSelect: (id: string) => void;
  readonly onBackToResults: () => void;
  readonly onToggleSheet: () => void;
}

export function ResultsPanel({
  ref,
  isDesktop,
  messages,
  results,
  selectedId,
  selectionCount,
  restoreRowFocus,
  sheet,
  details,
  onSelect,
  onBackToResults,
  onToggleSheet,
}: ResultsPanelProps) {
  const sheetShowsDetails = !isDesktop && details !== undefined;
  const sheetExpanded = sheet === "expanded";
  const showSheetBack = sheetShowsDetails && sheetExpanded;
  const nearest = results[0];
  const nearestSummary = nearest
    ? interpolate(messages.nearestResult, { name: nearest.name, distance: nearest.distance })
    : "";
  const sheetToggleLabel = sheetShowsDetails
    ? messages.detailsLabel
    : !sheetExpanded && nearestSummary
      ? nearestSummary
      : messages.results;

  return (
    <section
      ref={ref}
      className="results"
      data-sheet={isDesktop ? undefined : sheet}
      data-view={sheetShowsDetails ? "details" : undefined}
      aria-label={messages.resultsTitle}
    >
      <span className="visually-hidden" aria-live="polite" aria-atomic="true">
        {nearestSummary}
      </span>
      {isDesktop ? (
        <div className="results__header">
          <h2 className="results__title">{messages.resultsTitle}</h2>
        </div>
      ) : (
        <div className="results__toolbar">
          {showSheetBack ? (
            <button type="button" className="back-button" onClick={onBackToResults}>
              <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
                <path d="M10 3 5 8l5 5" fill="none" stroke="currentColor" strokeWidth="2" />
              </svg>
              {messages.backToResults}
            </button>
          ) : null}
          <button
            type="button"
            className="sheet-toggle"
            aria-label={showSheetBack ? sheetToggleLabel : undefined}
            aria-expanded={sheetExpanded}
            aria-controls="results-content"
            onClick={onToggleSheet}
          >
            {!showSheetBack ? (
              <span className="sheet-toggle__label">{sheetToggleLabel}</span>
            ) : null}
            <svg className="sheet-toggle__chevron" viewBox="0 0 16 16" aria-hidden="true">
              <path d="m3 10 5-5 5 5" fill="none" stroke="currentColor" strokeWidth="2" />
            </svg>
          </button>
        </div>
      )}

      <div
        key={sheetShowsDetails ? `details-${selectionCount}` : "list"}
        id="results-content"
        className="results__content"
        hidden={!isDesktop && !sheetExpanded}
      >
        {sheetExpanded && sheetShowsDetails ? (
          details
        ) : isDesktop || sheetExpanded ? (
          <ol className="results__list">
            {results.map(({ pharmacy, name, distance, band }) => {
              const isSelected = pharmacy.id === selectedId;
              return (
                <ResultRow
                  key={pharmacy.id}
                  id={pharmacy.id}
                  name={name}
                  distance={distance}
                  distanceBand={band}
                  selected={isSelected}
                  focus={isSelected && restoreRowFocus}
                  onSelect={onSelect}
                />
              );
            })}
          </ol>
        ) : null}
      </div>
    </section>
  );
}
