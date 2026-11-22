import { describe, expect, it } from "vitest";
import { pharmacySnapshot } from "../../data";
import { messagesFor } from "../../shared/i18n/messages";
import { defaultOrigin } from "../origin/origin";
import { addressLines, displayName } from "./format";
import { nearestPharmacies, pinPosition, resultLimit } from "./results";

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
