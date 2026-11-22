import { describe, expect, it } from "vitest";
import fixture from "../../fixtures/ranking/ranking-v1.json";
import { pharmacySnapshot } from "../data";
import { messagesFor } from "../i18n/messages";
import { addressLines, displayName } from "./format";
import {
  appReducer,
  defaultOrigin,
  initialState,
  nearestPharmacies,
  pinPosition,
  resultLimit,
  type AppState,
} from "./state";

describe("default origin", () => {
  it("is Helsinki Central Railway Station from the ranking fixture", () => {
    const station = fixture.origins.find((origin) => origin.osmId === "node/25474663")!;
    expect(defaultOrigin).toMatchObject({ lat: station.lat, lon: station.lon });
  });
});

describe("nearestPharmacies", () => {
  const results = nearestPharmacies(defaultOrigin, pharmacySnapshot.pharmacies);

  it("lists the nearest 20 from the whole snapshot in distance order", () => {
    expect(results).toHaveLength(resultLimit);
    expect(results[0]!.pharmacy.name).toBe("Steissin Apteekki");
    expect(results.map((row) => row.pharmacy.name).slice(0, 4)).toEqual([
      "Steissin Apteekki",
      "Apteekki CityCenter",
      "Yliopiston apteekki",
      "Kluuvin apteekki",
    ]);
    const distances = results.map((row) => row.distanceMeters);
    expect(distances).toEqual(distances.toSorted((a, b) => a - b));
  });
});

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
});

describe("pharmacy display helpers", () => {
  const messages = messagesFor("fi");

  it("uses the pin point of areas and the location of nodes", () => {
    expect(pinPosition({ id: "way/1", lat: 1, lon: 2, pin: { lat: 3, lon: 4 } })).toEqual({
      lat: 3,
      lon: 4,
    });
    expect(pinPosition({ id: "node/1", lat: 1, lon: 2 })).toEqual({ lat: 1, lon: 2 });
  });

  it("falls back to the localized unnamed label", () => {
    expect(displayName({ id: "node/1", lat: 0, lon: 0 }, messages)).toBe("Nimetön apteekki");
    expect(displayName({ id: "node/1", name: " ", lat: 0, lon: 0 }, messages)).toBe(
      "Nimetön apteekki",
    );
    expect(displayName({ id: "node/1", name: "Apteekki", lat: 0, lon: 0 }, messages)).toBe(
      "Apteekki",
    );
  });

  it("builds address lines from the available fields", () => {
    const base = { id: "node/1", lat: 0, lon: 0 };
    expect(
      addressLines({
        ...base,
        address: { street: "Elielinaukio", housenumber: "3", postcode: "00100", city: "Helsinki" },
      }),
    ).toEqual(["Elielinaukio 3", "00100 Helsinki"]);
    expect(addressLines({ ...base, address: { street: "Keskuskatu" } })).toEqual(["Keskuskatu"]);
    expect(addressLines({ ...base, address: { housenumber: "3" } })).toEqual([]);
    expect(addressLines(base)).toEqual([]);
  });
});
