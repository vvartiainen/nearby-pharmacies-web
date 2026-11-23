/* oxlint-disable jsx-a11y/prefer-tag-over-role -- The submitted-search combobox needs a listbox with two-line options. */
import { useRef, useState, type FocusEvent } from "react";
import type { Origin } from "./origin";
import { interpolate, type Messages } from "../../shared/i18n/messages";
import type { PlaceMatch } from "./geocoder";
import type { useOriginControls } from "./useOriginControls";

export function OriginControls({
  controls,
  messages,
  origin,
  originLabel,
  originTitle,
  originContext,
}: {
  controls: ReturnType<typeof useOriginControls>;
  messages: Messages;
  origin: Origin;
  originLabel: string;
  originTitle: string;
  originContext: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<{ origin: Origin; text: string } | null>(null);
  const [editing, setEditing] = useState(false);
  const [activeMatch, setActiveMatch] = useState<{
    matches: readonly PlaceMatch[];
    index: number;
  } | null>(null);
  const query = editing && draft?.origin === origin ? draft.text : null;
  const { search, location, provider } = controls;
  const pending = search.kind === "pending";
  const locating = location === "pending";
  const matches = editing && search.kind === "matches" ? search.matches : null;
  const activeIndex = activeMatch?.matches === matches ? activeMatch.index : -1;
  const privacy =
    provider === "local"
      ? messages.searchPrivacyLocal
      : provider === "photon"
        ? messages.searchPrivacyPhoton
        : messages.searchPrivacy;
  const locationMessage = {
    idle: "",
    pending: messages.locationPending,
    denied: messages.locationDenied,
    timeout: messages.locationTimeout,
    unavailable: messages.locationUnavailable,
  }[location];

  function endEditing(event: FocusEvent<HTMLElement>) {
    if (!event.currentTarget.closest("form")?.contains(event.relatedTarget)) setEditing(false);
  }

  function chooseMatch(match: PlaceMatch) {
    controls.changeOrigin({ ...match, kind: "search" });
    inputRef.current?.focus({ preventScroll: true });
    setEditing(false);
  }

  function moveActiveMatch(step: 1 | -1) {
    if (!matches) return;
    const index =
      activeIndex === -1 && step === -1
        ? matches.length - 1
        : (activeIndex + step + matches.length) % matches.length;
    setActiveMatch({ matches, index });
    document.getElementById(`origin-match-${index}`)?.scrollIntoView({ block: "nearest" });
  }

  return (
    <div className="origin-controls">
      <form
        className="origin-search"
        onSubmit={(event) => {
          event.preventDefault();
          if (query !== null) void controls.submitSearch(query);
        }}
      >
        <div className="origin-search__entry">
          <div className="origin-search__field">
            <div className="origin-search__value" data-editing={editing}>
              <input
                ref={inputRef}
                type="search"
                role="combobox"
                aria-autocomplete="none"
                aria-expanded={matches !== null}
                aria-controls={matches ? "origin-matches" : undefined}
                aria-activedescendant={activeIndex >= 0 ? `origin-match-${activeIndex}` : undefined}
                data-testid="origin"
                aria-label={provider === "local" ? messages.searchLabelLocal : messages.searchLabel}
                aria-describedby="search-privacy"
                value={query ?? originLabel}
                title={query === null ? originLabel : undefined}
                maxLength={180}
                onFocus={(event) => {
                  setEditing(true);
                  if (draft?.origin !== origin) event.currentTarget.select();
                }}
                onClick={(event) => {
                  if (!editing) {
                    event.currentTarget.select();
                    setEditing(true);
                  }
                }}
                onBlur={endEditing}
                onChange={(event) => {
                  setEditing(true);
                  setDraft({ origin, text: event.currentTarget.value });
                  controls.cancelSearch();
                }}
                onKeyDown={(event) => {
                  if (
                    query === null &&
                    !event.nativeEvent.isComposing &&
                    !event.metaKey &&
                    !event.ctrlKey &&
                    !event.altKey &&
                    (event.key.length === 1 || event.key === "Backspace" || event.key === "Delete")
                  ) {
                    event.preventDefault();
                    setDraft({ origin, text: event.key.length === 1 ? event.key : "" });
                    setEditing(true);
                    controls.cancelSearch();
                    return;
                  }
                  if (matches && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
                    event.preventDefault();
                    moveActiveMatch(event.key === "ArrowDown" ? 1 : -1);
                  } else if (matches && event.key === "Enter" && activeIndex >= 0) {
                    event.preventDefault();
                    chooseMatch(matches[activeIndex]!);
                  } else if (event.key === "Escape" && query !== null) {
                    event.preventDefault();
                    setDraft(null);
                    controls.cancelSearch();
                  }
                }}
              />
              <div className="origin-search__summary" aria-hidden="true">
                <span className="origin-search__title">{originTitle}</span>
                {originContext ? (
                  <span className="origin-search__locality">{originContext}</span>
                ) : null}
              </div>
            </div>
            <button
              type="button"
              className="origin-location"
              aria-label={messages.useMyLocation}
              aria-describedby={controls.offerLocation ? "location-privacy" : undefined}
              aria-busy={locating}
              onBlur={endEditing}
              onClick={() => {
                setDraft(null);
                controls.cancelSearch();
                controls.requestLocation();
              }}
              disabled={locating}
            >
              {locating ? (
                <span className="origin-location__spinner" aria-hidden="true" />
              ) : (
                <svg
                  viewBox="0 0 24 24"
                  width="20"
                  height="20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="6.5" />
                  <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
                  <path d="M12 2v3.5m0 13V22M2 12h3.5m13 0H22" />
                </svg>
              )}
            </button>
          </div>
          <button
            type="submit"
            className="origin-action origin-action--primary"
            onBlur={endEditing}
            onPointerDown={(event) => event.preventDefault()}
            disabled={pending || !query?.trim()}
          >
            {pending ? messages.searchPending : messages.searchButton}
          </button>
          {matches && search.kind === "matches" ? (
            <div className="origin-matches">
              {search.local ? (
                <p className="origin-matches__note origin-controls__caption">
                  {messages.localMatches}
                </p>
              ) : null}
              <div
                className="origin-matches__list"
                id="origin-matches"
                role="listbox"
                aria-label={messages.chooseMatch}
              >
                {matches.map((match, index) => (
                  <button
                    key={match.label}
                    id={`origin-match-${index}`}
                    type="button"
                    role="option"
                    tabIndex={-1}
                    aria-label={match.label}
                    aria-selected={index === activeIndex}
                    className="origin-matches__option"
                    onPointerDown={(event) => event.preventDefault()}
                    onPointerMove={(event) => {
                      if (event.pointerType === "mouse" && activeIndex !== index)
                        setActiveMatch({ matches, index });
                    }}
                    onClick={() => chooseMatch(match)}
                  >
                    <span>{match.title}</span>
                    {match.context ? (
                      <span className="origin-controls__caption">{match.context}</span>
                    ) : null}
                  </button>
                ))}
              </div>
              <div className="origin-matches__note origin-controls__caption">
                <a href="https://www.openstreetmap.org/copyright" onBlur={endEditing}>
                  {messages.searchAttribution}
                </a>
              </div>
            </div>
          ) : null}
        </div>
        <p id="search-privacy" className="origin-controls__caption">
          {privacy} {provider !== "local" ? messages.searchPrivacyPublicPlaces : null}
        </p>
      </form>
      {controls.offerLocation ? (
        <div className="location-prompt">
          <div>
            <p className="location-prompt__title">{messages.locationPromptTitle}</p>
            <p id="location-privacy" className="origin-controls__caption">
              {messages.locationPromptBody}
            </p>
          </div>
          <button type="button" className="origin-action" onClick={controls.dismissLocationOffer}>
            {messages.locationPromptDismiss}
          </button>
        </div>
      ) : null}
      {locationMessage ? (
        <output className={locating ? "visually-hidden" : "origin-controls__caption"}>
          {locationMessage}
        </output>
      ) : null}
      {search.kind === "empty" || search.kind === "unavailable" ? (
        <output className="origin-controls__caption">
          {search.kind === "empty"
            ? interpolate(messages.noMatches, { query: search.query })
            : messages.searchUnavailable}
        </output>
      ) : null}
    </div>
  );
}
