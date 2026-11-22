import type { Pharmacy } from "../data/schema";
import type { LatLon } from "../ranking/haversine";
import { rankPharmacies, type RankedPharmacy } from "../ranking/rank";

/** How many nearest pharmacies the list and the map show. */
export const resultLimit = 20;

/** OSM node/25474663, Helsinki Central Railway Station, as in the ranking fixture. */
export const defaultOrigin: Origin = { kind: "default", lat: 60.1720965, lon: 24.9412486 };

/** The active starting point. Checkpoint 2 adds search matches, device location and dropped pins. */
export interface Origin extends LatLon {
  readonly kind: "default";
}

export type SelectionSource = "row" | "pin";

export interface AppState {
  readonly origin: Origin;
  /** One selected pharmacy drives the row, the pin and the details. */
  readonly selectedId: string | null;
  /** Row selections move focus to the details. Pin selections keep focus on the map. */
  readonly selectionSource: SelectionSource | null;
  /**
   * Whether the details of the selection are open: in the details card over the map on desktop, in
   * place of the list in the narrow sheet.
   */
  readonly view: "list" | "details";
  /** Narrow layouts only: the results sheet in its peek or expanded state. Selection and returning to the list expand it. */
  readonly sheet: "peek" | "expanded";
  /** True after leaving the details, so the list moves focus back to the selected row. */
  readonly restoreRowFocus: boolean;
  /** Increments with each selection so the map reacts to re-selecting the same pharmacy. */
  readonly selectionCount: number;
}

export type AppAction =
  | { type: "select"; id: string; source: SelectionSource }
  /** "Back to results" in the narrow sheet, or closing the desktop details card. */
  | { type: "backToResults" }
  | { type: "toggleSheet" }
  | { type: "setOrigin"; origin: Origin };

export const initialState: AppState = {
  origin: defaultOrigin,
  selectedId: null,
  selectionSource: null,
  view: "list",
  sheet: "peek",
  restoreRowFocus: false,
  selectionCount: 0,
};

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "select":
      return {
        ...state,
        selectedId: action.id,
        selectionSource: action.source,
        view: "details",
        sheet: "expanded",
        restoreRowFocus: false,
        selectionCount: state.selectionCount + 1,
      };
    case "backToResults":
      return { ...state, view: "list", sheet: "expanded", restoreRowFocus: true };
    case "toggleSheet":
      return {
        ...state,
        sheet: state.sheet === "peek" ? "expanded" : "peek",
        restoreRowFocus: false,
      };
    case "setOrigin":
      // A new origin reranks, so the old selection no longer belongs to the results.
      return {
        ...state,
        origin: action.origin,
        selectedId: null,
        selectionSource: null,
        view: "list",
        restoreRowFocus: false,
      };
  }
}

/** The nearest pharmacies from the origin, in ranking order. Depends on the origin only. */
export function nearestPharmacies(
  origin: LatLon,
  pharmacies: readonly Pharmacy[],
  limit = resultLimit,
): RankedPharmacy<Pharmacy>[] {
  return rankPharmacies(origin, pharmacies).slice(0, limit);
}

/** The point where a pharmacy's pin is drawn: the interior point of an area, else its location. */
export function pinPosition(pharmacy: Pharmacy): LatLon {
  return pharmacy.pin ?? { lat: pharmacy.lat, lon: pharmacy.lon };
}
