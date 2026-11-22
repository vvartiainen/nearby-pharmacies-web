// Typed entry point for the bundled data written by `pnpm run data:import`. Importing this module
// bundles the snapshot; load the place index lazily with `import("./places.fi.json")` once the
// PBF import has produced it.
import manifest from "./manifest.fi.json";
import snapshot from "./pharmacies.fi.json";
import type { PharmacySnapshot } from "./schema";

export const pharmacySnapshot: PharmacySnapshot = snapshot;
export const dataManifest = manifest;
