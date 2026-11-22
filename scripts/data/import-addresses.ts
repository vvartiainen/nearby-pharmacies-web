import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import {
  addressCell,
  addressCoordinateScale,
  type AddressShard,
} from "../../src/features/origin/addressGrid.ts";
import { bboxOf } from "./geometry.ts";
import { NodeStore } from "./node-store.ts";
import { readPbf, type Tags } from "./osm-pbf.ts";

const [input, outDir = "public/address-index"] = process.argv.slice(2);
if (!input) throw new Error("Usage: pnpm run data:addresses <finland.osm.pbf> [output directory]");

type Point = AddressShard["points"][number];

interface Shard {
  streets: Map<string, number>;
  cities: Map<string, number>;
  points: Point[];
}

const shards = new Map<string, Shard>();
const nodes = new NodeStore();
const ways: { refs: number[]; tags: Tags }[] = [];

function addressParts(tags: Tags | undefined) {
  const street = (tags?.["addr:street"] || tags?.["addr:place"])?.trim();
  const number = tags?.["addr:housenumber"]?.trim();
  const city = tags?.["addr:city"]?.trim() ?? "";
  return street && number ? { street, number, city } : undefined;
}

function intern(key: string, table: Map<string, number>) {
  const id = table.get(key);
  if (id !== undefined) return id;
  const next = table.size;
  table.set(key, next);
  return next;
}

function addAddress(lat: number, lon: number, tags: Tags | undefined) {
  const address = addressParts(tags);
  if (!address) return;
  const latUnits = Math.round(lat * addressCoordinateScale);
  const lonUnits = Math.round(lon * addressCoordinateScale);
  const cell = addressCell(latUnits / addressCoordinateScale, lonUnits / addressCoordinateScale);
  let shard = shards.get(cell);
  if (!shard) {
    shard = { streets: new Map(), cities: new Map(), points: [] };
    shards.set(cell, shard);
  }
  shard.points.push([
    latUnits,
    lonUnits,
    intern(address.street, shard.streets),
    address.number,
    intern(address.city, shard.cities),
  ]);
}

readPbf(input, {
  tagKeys: new Set(["addr:housenumber"]),
  node(_id, latNano, lonNano, tags) {
    if (tags) addAddress(latNano / 1e9, lonNano / 1e9, tags);
  },
  wantWay(_id, tags) {
    return addressParts(tags) !== undefined;
  },
  way(_id, refs, tags) {
    if (!tags) return;
    for (const ref of refs) nodes.add(ref);
    ways.push({ refs, tags });
  },
});

nodes.freeze();
readPbf(input, {
  tagKeys: new Set(),
  node(id, latNano, lonNano) {
    const index = nodes.indexOf(id);
    if (index >= 0) nodes.set(index, latNano, lonNano);
  },
});

for (const { refs, tags } of ways) {
  const positions = refs.map((ref) => nodes.position(ref));
  if (positions.some((point) => point === undefined)) continue;
  const box = bboxOf(positions.filter((point) => point !== undefined));
  if (box) addAddress((box.minLat + box.maxLat) / 2, (box.minLon + box.maxLon) / 2, tags);
}

mkdirSync(outDir, { recursive: true });
let records = 0;
for (const [cell, shard] of shards) {
  const points = shard.points.toSorted((a, b) => a[0] - b[0] || a[1] - b[1]);
  const output: AddressShard = {
    streets: [...shard.streets.keys()],
    cities: [...shard.cities.keys()],
    points,
  };
  writeFileSync(join(outDir, `${cell}.json.gz`), gzipSync(JSON.stringify(output)));
  records += points.length;
}
writeFileSync(
  join(outDir, "index.json"),
  JSON.stringify([...shards.keys()].toSorted(), null, 2) + "\n",
);
console.log(`data:addresses: wrote ${records} addresses in ${shards.size} shards to ${outDir}`);
