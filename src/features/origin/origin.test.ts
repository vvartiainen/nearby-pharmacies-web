import { describe, expect, it } from "vitest";
import fixture from "../../../fixtures/ranking/ranking-v1.json";
import { defaultOrigin } from "./origin";

describe("default origin", () => {
  it("is Helsinki Central Railway Station from the ranking fixture", () => {
    const station = fixture.origins.find((origin) => origin.osmId === "node/25474663")!;
    expect(defaultOrigin).toMatchObject({ lat: station.lat, lon: station.lon });
  });
});
