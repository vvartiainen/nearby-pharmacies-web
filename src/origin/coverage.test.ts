import { describe, expect, it } from "vitest";
import borderSample from "../../docs/research/samples/tornio-haparanda-border.json";
import { defaultOrigin } from "../app/state";
import { originCoverage } from "./coverage";

describe("originCoverage", () => {
  it("distinguishes a Finnish town near a land border from the Swedish side", () => {
    expect(originCoverage(borderSample.origin)).toBe("border");
    expect(originCoverage(borderSample.otherOrigins[0]!)).toBe("outside");
  });

  it("includes Helsinki, the south coast and Åland without a land-border notice", () => {
    expect(originCoverage(defaultOrigin)).toBe("covered");
    expect(originCoverage({ lat: 59.8245, lon: 22.9687 })).toBe("covered");
    expect(originCoverage({ lat: 60.0973, lon: 19.9348 })).toBe("covered");
  });
});
