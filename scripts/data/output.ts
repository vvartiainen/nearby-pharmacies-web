import { createHash } from "node:crypto";
import { closeSync, openSync, readSync } from "node:fs";
import type { Pharmacy, PharmacySnapshot, Place, PlaceIndex } from "../../src/data/schema.ts";
import { EARTH_MEAN_RADIUS_METERS } from "../../src/ranking/haversine.ts";
import type { DroppedDuplicate, SameNamePair } from "./normalize.ts";

/** Bump when the importer's output for the same input changes. */
export const IMPORTER_VERSION = "1.0.0";

export const dataFileNames = (region: string) => ({
  pharmacies: `pharmacies.${region}.json`,
  places: `places.${region}.json`,
  manifest: `manifest.${region}.json`,
  notice: "ODbL-NOTICE.txt",
});

export const ODBL_NOTICE = `Pharmacy and place data © OpenStreetMap contributors, data available under the Open Database License (ODbL) v1.0.
https://www.openstreetmap.org/copyright
https://opendatacommons.org/licenses/odbl/1-0/

The files pharmacies.*.json and places.*.json are a Derived Database of OpenStreetMap, produced
by scripts/data/import.ts in the nearby-pharmacies-web repository. They are made available under
the ODbL. The manifest.*.json file names the source extract, its replication timestamp and
SHA-256, so the same snapshot can be reproduced from the same input.
`;

export const sha256 = (data: string | Uint8Array) =>
  createHash("sha256").update(data).digest("hex");

/** SHA-256 of a file read in 1 MiB chunks, so a large extract is never held in memory. */
export function sha256File(path: string): { sha256: string; bytes: number } {
  const hash = createHash("sha256");
  const fd = openSync(path, "r");
  const buffer = Buffer.alloc(1 << 20);
  let bytes = 0;
  try {
    for (let read; (read = readSync(fd, buffer, 0, buffer.length, bytes)) > 0; bytes += read) {
      hash.update(buffer.subarray(0, read));
    }
  } finally {
    closeSync(fd);
  }
  return { sha256: hash.digest("hex"), bytes };
}

/**
 * Stable text for a list file: a fixed header line, then one compact JSON record per line, so a
 * changed pharmacy is a one-line diff. Key order comes from how records are built.
 */
function serializeList(head: Record<string, unknown>, key: string, records: readonly unknown[]) {
  const prefix = JSON.stringify(head).slice(0, -1);
  const body = records.map((record) => JSON.stringify(record)).join(",\n");
  return `${prefix},"${key}":[\n${body}\n]}\n`;
}

export function serializeSnapshot(region: string, pharmacies: readonly Pharmacy[]): string {
  const head: Omit<PharmacySnapshot, "pharmacies"> = { schemaVersion: 1, region };
  return serializeList(head, "pharmacies", pharmacies);
}

export function serializePlaces(region: string, places: readonly Place[]): string {
  const head: Omit<PlaceIndex, "places"> = { schemaVersion: 1, region };
  return serializeList(head, "places", places);
}

export interface ManifestInput {
  region: string;
  kind: "osm-pbf" | "overpass-interim";
  notes: string[];
  source: {
    url: string;
    filename: string;
    sha256: string;
    bytes: number;
    /** ISO 8601 UTC time of the OSM data (PBF replication timestamp or Overpass osm_base). */
    dataTimestamp: string | null;
    replicationSequence?: number;
    query?: string;
  };
  regionFilter: Record<string, string>;
  files: Record<string, { path: string; sha256: string; bytes: number; records?: number } | null>;
  counts: Record<string, number>;
  droppedDuplicates: DroppedDuplicate[];
  sameNamePairs: SameNamePair[];
  outsideRegion: string[];
  warnings: string[];
}

/**
 * The manifest carries no wall-clock time: `generatedAt` is SOURCE_DATE_EPOCH when set (the
 * reproducible-builds convention), otherwise the source data timestamp.
 */
export function serializeManifest(input: ManifestInput, sourceDateEpoch?: string): string {
  const generatedAt = sourceDateEpoch
    ? new Date(Number(sourceDateEpoch) * 1000).toISOString().replace(".000Z", "Z")
    : input.source.dataTimestamp;
  const manifest = {
    schemaVersion: 1,
    region: input.region,
    kind: input.kind,
    interim: input.kind === "overpass-interim",
    notes: input.notes,
    source: input.source,
    generatedAt,
    generatedAtFrom: sourceDateEpoch ? "SOURCE_DATE_EPOCH" : "source data timestamp",
    importer: { script: "scripts/data/import.ts", version: IMPORTER_VERSION },
    licence: {
      name: "ODbL-1.0",
      attribution: "© OpenStreetMap contributors",
      url: "https://www.openstreetmap.org/copyright",
      notice: dataFileNames(input.region).notice,
    },
    regionFilter: input.regionFilter,
    ranking: {
      formula: "haversine",
      earthRadiusMeters: EARTH_MEAN_RADIUS_METERS,
      tieBreak: "id, UTF-16 code-unit order",
      fixture: "fixtures/ranking/ranking-v1.json",
    },
    files: input.files,
    counts: input.counts,
    droppedDuplicates: input.droppedDuplicates,
    sameNamePairs: input.sameNamePairs,
    outsideRegion: input.outsideRegion,
    warnings: input.warnings,
  };
  return `${JSON.stringify(manifest, null, 2)}\n`;
}
