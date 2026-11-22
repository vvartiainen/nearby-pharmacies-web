// Builds the bundled pharmacy snapshot, place index, manifest and ODbL notice.
//
//   pnpm run data:import -- --input finland-latest.osm.pbf --region fi
//   pnpm run data:import -- --overpass /tmp/task3a/finland.json --region fi   (interim snapshot)
//
// Options: --out-dir (default src/data), --source-url, --region-filter boundary|extract,
// --municipality-admin-level (default 8). See docs/data/README.md.

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { parseArgs } from "node:util";
import { buildPharmacies } from "./normalize.ts";
import {
  dataFileNames,
  ODBL_NOTICE,
  serializeManifest,
  serializePlaces,
  serializeSnapshot,
  sha256,
  sha256File,
  type ManifestInput,
} from "./output.ts";
import { featuresFromOverpass, type OverpassResponse } from "./overpass.ts";
import { importPbf } from "./pbf-import.ts";

const defaultSourceUrls: Record<string, string> = {
  fi: "https://download.geofabrik.de/europe/finland-latest.osm.pbf",
};
const overpassQueryFile = "docs/research/queries/finland-pharmacies.overpassql";

const { values } = parseArgs({
  args: process.argv.slice(2).filter((arg) => arg !== "--"),
  options: {
    input: { type: "string" },
    overpass: { type: "string" },
    region: { type: "string", default: "fi" },
    "out-dir": { type: "string", default: "src/data" },
    "source-url": { type: "string" },
    "region-filter": { type: "string", default: "boundary" },
    "municipality-admin-level": { type: "string", default: "8" },
  },
});

const region = values.region.toLowerCase();
if (!/^[a-z]{2}$/.test(region))
  throw new Error(`--region must be a two-letter code, got ${region}`);
if (!values.input === !values.overpass) {
  console.error("Pass exactly one of --input <extract.osm.pbf> or --overpass <response.json>.");
  process.exit(2);
}
const regionFilter = values["region-filter"];
if (regionFilter !== "boundary" && regionFilter !== "extract") {
  throw new Error("--region-filter must be boundary or extract");
}

const outDir = values["out-dir"];
const names = dataFileNames(region);
const log = (message: string) => console.error(`data:import: ${message}`);
const sourcePath = values.input ?? values.overpass ?? "";
const source = sha256File(sourcePath);
let manifestInput: Omit<ManifestInput, "files">;
let snapshotText: string;
let placesText: string | undefined;
let pharmacyCount: number;
let placeCount = 0;

if (values.input) {
  const result = importPbf(values.input, {
    region,
    regionFilter,
    municipalityAdminLevel: values["municipality-admin-level"],
    log,
  });
  const { pharmacies, dropped, sameNamePairs } = buildPharmacies(result.features);
  snapshotText = serializeSnapshot(region, pharmacies);
  placesText = serializePlaces(region, result.places);
  pharmacyCount = pharmacies.length;
  placeCount = result.places.length;
  const kinds = (prefix: string) => result.features.filter((f) => f.id.startsWith(prefix)).length;
  const timestamp = result.header.replicationTimestamp;
  manifestInput = {
    region,
    kind: "osm-pbf",
    notes: [
      "Built from an OSM PBF regional extract. Areas use the bounding-box centre for distance and an interior point (pin) for the map.",
      "Villages get a municipality when a municipality boundary contains them; municipalities are listed with their admin centre or an interior point.",
    ],
    source: {
      url: values["source-url"] ?? defaultSourceUrls[region] ?? "",
      filename: basename(values.input),
      sha256: source.sha256,
      bytes: source.bytes,
      dataTimestamp:
        timestamp === undefined
          ? null
          : new Date(timestamp * 1000).toISOString().replace(".000Z", "Z"),
      ...(result.header.replicationSequence === undefined
        ? {}
        : { replicationSequence: result.header.replicationSequence }),
    },
    regionFilter:
      regionFilter === "boundary"
        ? { method: "country boundary", relation: result.boundaryId ?? "" }
        : { method: "whole extract" },
    counts: {
      features: result.features.length + result.outsideRegion.length,
      nodes: kinds("node/"),
      ways: kinds("way/"),
      relations: kinds("relation/"),
      outsideRegion: result.outsideRegion.length,
      droppedDuplicates: dropped.length,
      pharmacies: pharmacies.length,
      places: result.places.length,
      municipalitiesWithoutGeometry: result.municipalitiesWithoutGeometry,
    },
    droppedDuplicates: dropped,
    sameNamePairs,
    outsideRegion: result.outsideRegion,
    warnings: result.warnings,
  };
  for (const warning of result.warnings) log(`warning: ${warning}`);
} else {
  const response = JSON.parse(readFileSync(sourcePath, "utf8")) as OverpassResponse;
  const { features, skipped } = featuresFromOverpass(response);
  const { pharmacies, dropped, sameNamePairs } = buildPharmacies(features);
  snapshotText = serializeSnapshot(region, pharmacies);
  pharmacyCount = pharmacies.length;
  const kinds = (prefix: string) => features.filter((f) => f.id.startsWith(prefix)).length;
  manifestInput = {
    region,
    kind: "overpass-interim",
    notes: [
      "INTERIM snapshot built from an Overpass API response, not from a regional PBF extract. Replace it with the PBF import (pnpm run data:import -- --input finland-latest.osm.pbf --region fi).",
      "Areas have only the Overpass bounding-box centre: no interior pin points, and the duplicate rule checked the 50 m distance only, not 'inside the outline'.",
      "No place index: the Overpass query returns pharmacies only.",
      "Region restriction came from the Overpass area query (ISO3166-1=FI, admin_level=2).",
    ],
    source: {
      url: "https://overpass-api.de/api/interpreter",
      filename: basename(sourcePath),
      sha256: source.sha256,
      bytes: source.bytes,
      dataTimestamp: response.osm3s?.timestamp_osm_base ?? null,
      query: overpassQueryFile,
    },
    regionFilter: { method: "Overpass area query", query: overpassQueryFile },
    counts: {
      features: features.length,
      nodes: kinds("node/"),
      ways: kinds("way/"),
      relations: kinds("relation/"),
      skippedWithoutCoordinates: skipped.length,
      droppedDuplicates: dropped.length,
      pharmacies: pharmacies.length,
    },
    droppedDuplicates: dropped,
    sameNamePairs,
    outsideRegion: [],
    warnings: skipped.map((id) => `${id}: no coordinates in the response, skipped`),
  };
}

mkdirSync(outDir, { recursive: true });
const write = (name: string, text: string) => {
  writeFileSync(join(outDir, name), text);
  return { path: name, sha256: sha256(text), bytes: Buffer.byteLength(text) };
};
const files: ManifestInput["files"] = {
  pharmacies: { ...write(names.pharmacies, snapshotText), records: pharmacyCount },
  places: null,
  notice: write(names.notice, ODBL_NOTICE),
};
if (placesText) {
  files.places = { ...write(names.places, placesText), records: placeCount };
} else if (existsSync(join(outDir, names.places))) {
  rmSync(join(outDir, names.places));
  log(`removed stale ${names.places}: this snapshot has no place index`);
}
writeFileSync(
  join(outDir, names.manifest),
  serializeManifest({ ...manifestInput, files }, process.env.SOURCE_DATE_EPOCH),
);

for (const drop of manifestInput.droppedDuplicates) {
  log(`dropped ${drop.id}: unnamed, ${drop.reason} of ${drop.keptId} (${drop.distanceMeters} m)`);
}
for (const pair of manifestInput.sameNamePairs) {
  log(
    `review same-name pair "${pair.name}": ${pair.ids.join(" and ")} ${pair.distanceMeters} m apart`,
  );
}
log(
  `wrote ${pharmacyCount} pharmacies${placesText ? ` and ${placeCount} places` : ""} to ${outDir}/ ` +
    `(${manifestInput.kind}, data ${manifestInput.source.dataTimestamp ?? "timestamp unknown"})`,
);
