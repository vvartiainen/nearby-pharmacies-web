import { describe, expect, it } from "vitest";
import { defaultOrigin } from "../features/origin/origin";
import { appReducer, initialState, type AppState } from "./state";

describe("appReducer", () => {
  const selected = appReducer(initialState, { type: "select", id: "node/1", source: "row" });

  it("starts at the default origin with nothing selected and the sheet in peek", () => {
    expect(initialState).toMatchObject({
      origin: defaultOrigin,
      selectedId: null,
      view: "list",
      sheet: "peek",
    });
  });

  it("selects one pharmacy and shows its details", () => {
    expect(selected).toMatchObject({
      selectedId: "node/1",
      selectionSource: "row",
      view: "details",
      selectionCount: 1,
    });
  });

  it("expands the sheet when selecting a row or pin", () => {
    expect(selected.sheet).toBe("expanded");
    expect(appReducer(initialState, { type: "select", id: "node/1", source: "pin" }).sheet).toBe(
      "expanded",
    );
  });

  it("never changes the origin when selecting", () => {
    const fromPin = appReducer(selected, { type: "select", id: "node/2", source: "pin" });
    expect(fromPin.origin).toBe(initialState.origin);
    expect(fromPin).toMatchObject({
      selectedId: "node/2",
      selectionSource: "pin",
      selectionCount: 2,
    });
  });

  it("goes back to the expanded list and keeps the selection", () => {
    const collapsed = appReducer(selected, { type: "toggleSheet" });
    expect(appReducer(collapsed, { type: "backToResults" })).toMatchObject({
      view: "list",
      selectedId: "node/1",
      sheet: "expanded",
      restoreRowFocus: true,
    });
  });

  it("toggles the sheet between peek and expanded", () => {
    const expanded = appReducer(initialState, { type: "toggleSheet" });
    expect(expanded.sheet).toBe("expanded");
    expect(appReducer(expanded, { type: "toggleSheet" }).sheet).toBe("peek");
  });

  it("clears the selection when the origin changes", () => {
    const origin = { kind: "default", lat: 61.5, lon: 23.76 } as const;
    const moved: AppState = appReducer(selected, { type: "setOrigin", origin });
    expect(moved).toMatchObject({ origin, selectedId: null, selectionSource: null, view: "list" });
  });

  it("expands the sheet for a point chosen on the map, and only then", () => {
    const pin = { kind: "pin", lat: 61.5, lon: 23.76 } as const;
    expect(appReducer(initialState, { type: "setOrigin", origin: pin }).sheet).toBe("expanded");
    const device = { kind: "device", lat: 61.5, lon: 23.76 } as const;
    expect(appReducer(initialState, { type: "setOrigin", origin: device }).sheet).toBe("peek");
  });
});
