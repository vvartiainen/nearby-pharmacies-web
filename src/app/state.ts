import { defaultOrigin, type Origin } from "../features/origin/origin";

export type SelectionSource = "row" | "pin";

export interface AppState {
  readonly origin: Origin;
  readonly selectedId: string | null;
  /** Row selections move focus to the details. Pin selections keep focus on the map. */
  readonly selectionSource: SelectionSource | null;
  readonly view: "list" | "details";
  readonly sheet: "peek" | "expanded";
  readonly restoreRowFocus: boolean;
  /** Increments with each selection so the map reacts to re-selecting the same pharmacy. */
  readonly selectionCount: number;
}

export type AppAction =
  | { type: "select"; id: string; source: SelectionSource }
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
      // A new origin reranks, so the old selection no longer belongs to the results. A point chosen
      // on the map opens the sheet to show its results, like iOS.
      return {
        ...state,
        origin: action.origin,
        sheet: action.origin.kind === "pin" ? "expanded" : state.sheet,
        selectedId: null,
        selectionSource: null,
        view: "list",
        restoreRowFocus: false,
      };
  }
}
