// Minimal streaming reader for the OpenStreetMap PBF format
// (https://wiki.openstreetmap.org/wiki/PBF_Format). It reads one blob at a time with positional
// reads, so memory stays bounded by the largest blob (32 MiB by the format) plus what the caller
// keeps. Protobuf decoding uses `pbf`; zlib and zstd come from node:zlib.

import { closeSync, openSync, readSync } from "node:fs";
import * as zlib from "node:zlib";
import { PbfReader } from "pbf";

export type Tags = Record<string, string>;

export interface PbfHeader {
  requiredFeatures: string[];
  optionalFeatures: string[];
  writingProgram?: string;
  source?: string;
  /** Seconds since the Unix epoch, from `osmosis_replication_timestamp`. */
  replicationTimestamp?: number;
  replicationSequence?: number;
  replicationBaseUrl?: string;
}

export interface RelationMember {
  type: "node" | "way" | "relation";
  ref: number;
  role: string;
}

/**
 * Callbacks for one pass. Coordinates are integer nanodegrees, exact for OSM's 1e-7 precision.
 * Tags are decoded only when an element has at least one key in `tagKeys`; otherwise the callback
 * receives `undefined`, which keeps untagged and uninteresting elements cheap.
 */
export interface PbfHandlers {
  tagKeys: ReadonlySet<string>;
  header?(header: PbfHeader): void;
  node?(id: number, latNano: number, lonNano: number, tags: Tags | undefined): void;
  /** Return true to receive the way's node references in `way`. */
  wantWay?(id: number, tags: Tags | undefined): boolean;
  way?(id: number, refs: number[], tags: Tags | undefined): void;
  relation?(id: number, members: RelationMember[], tags: Tags | undefined): void;
}

const supportedFeatures = new Set(["OsmSchema-V0.6", "DenseNodes"]);
const memberTypes = ["node", "way", "relation"] as const;

export function readPbf(path: string, handlers: PbfHandlers): void {
  const fd = openSync(path, "r");
  try {
    let position = 0;
    const lengthBuffer = Buffer.alloc(4);
    for (;;) {
      const read = readSync(fd, lengthBuffer, 0, 4, position);
      if (read === 0) break;
      if (read !== 4) throw new Error(`Truncated blob length at byte ${position}`);
      position += 4;
      const headerLength = lengthBuffer.readUInt32BE(0);
      const headerBytes = readExactly(fd, headerLength, position);
      position += headerLength;
      const blobHeader = parseBlobHeader(headerBytes);
      const blobBytes = readExactly(fd, blobHeader.dataSize, position);
      position += blobHeader.dataSize;
      const data = inflateBlob(blobBytes);
      if (blobHeader.type === "OSMHeader") {
        const header = parseHeaderBlock(data);
        const unsupported = header.requiredFeatures.filter((f) => !supportedFeatures.has(f));
        if (unsupported.length > 0) {
          throw new Error(`Unsupported required PBF features: ${unsupported.join(", ")}`);
        }
        handlers.header?.(header);
      } else if (blobHeader.type === "OSMData") {
        parsePrimitiveBlock(data, handlers);
      }
    }
  } finally {
    closeSync(fd);
  }
}

function readExactly(fd: number, length: number, position: number): Buffer {
  const buffer = Buffer.alloc(length);
  let offset = 0;
  while (offset < length) {
    const read = readSync(fd, buffer, offset, length - offset, position + offset);
    if (read === 0) throw new Error(`Truncated PBF file at byte ${position + offset}`);
    offset += read;
  }
  return buffer;
}

function parseBlobHeader(bytes: Uint8Array) {
  const header = { type: "", dataSize: 0 };
  const pbf = new PbfReader(bytes);
  for (let field; (field = pbf.nextField());) {
    if (field === 1) header.type = pbf.readString();
    else if (field === 3) header.dataSize = pbf.readVarint();
  }
  return header;
}

function inflateBlob(bytes: Uint8Array): Uint8Array {
  const pbf = new PbfReader(bytes);
  for (let field; (field = pbf.nextField());) {
    if (field === 1) return pbf.readBytes();
    if (field === 3) return zlib.inflateSync(pbf.readBytes());
    if (field === 7) {
      const zstd = (zlib as { zstdDecompressSync?: (input: Uint8Array) => Buffer })
        .zstdDecompressSync;
      if (!zstd) throw new Error("zstd-compressed PBF blobs need Node 22.15 or later");
      return zstd(pbf.readBytes());
    }
    if (field === 4 || field === 5 || field === 6) {
      throw new Error(`Unsupported PBF blob compression (field ${field})`);
    }
  }
  throw new Error("PBF blob has no data");
}

function parseHeaderBlock(bytes: Uint8Array): PbfHeader {
  const header: PbfHeader = { requiredFeatures: [], optionalFeatures: [] };
  const pbf = new PbfReader(bytes);
  for (let field; (field = pbf.nextField());) {
    if (field === 4) header.requiredFeatures.push(pbf.readString());
    else if (field === 5) header.optionalFeatures.push(pbf.readString());
    else if (field === 16) header.writingProgram = pbf.readString();
    else if (field === 17) header.source = pbf.readString();
    else if (field === 32) header.replicationTimestamp = pbf.readVarint(true);
    else if (field === 33) header.replicationSequence = pbf.readVarint(true);
    else if (field === 34) header.replicationBaseUrl = pbf.readString();
  }
  return header;
}

interface BlockContext {
  strings: string[];
  /** String-table indices of the keys the handlers care about. */
  keyIndices: Set<number>;
  granularity: number;
  latOffset: number;
  lonOffset: number;
}

function parsePrimitiveBlock(bytes: Uint8Array, handlers: PbfHandlers): void {
  const pbf = new PbfReader(bytes);
  const strings: string[] = [];
  const groups: Uint8Array[] = [];
  let granularity = 100;
  let latOffset = 0;
  let lonOffset = 0;
  for (let field; (field = pbf.nextField());) {
    if (field === 1) {
      const end = pbf.readVarint() + pbf.pos;
      for (let inner; (inner = pbf.nextField(end));) {
        if (inner === 1) strings.push(pbf.readString());
      }
    } else if (field === 2) {
      groups.push(pbf.readBytes());
    } else if (field === 17) granularity = pbf.readVarint();
    else if (field === 19) latOffset = pbf.readVarint(true);
    else if (field === 20) lonOffset = pbf.readVarint(true);
  }
  const keyIndices = new Set<number>();
  strings.forEach((value, index) => {
    if (handlers.tagKeys.has(value)) keyIndices.add(index);
  });
  const context: BlockContext = { strings, keyIndices, granularity, latOffset, lonOffset };
  for (const group of groups) parsePrimitiveGroup(new PbfReader(group), context, handlers);
}

function parsePrimitiveGroup(pbf: PbfReader, context: BlockContext, handlers: PbfHandlers): void {
  for (let field; (field = pbf.nextField());) {
    const length = pbf.readVarint();
    const messageEnd = pbf.pos + length;
    if (field === 1 && handlers.node) parseNode(pbf, messageEnd, context, handlers);
    else if (field === 2 && handlers.node) parseDenseNodes(pbf, messageEnd, context, handlers);
    else if (field === 3 && (handlers.way || handlers.wantWay)) {
      parseWay(pbf, messageEnd, context, handlers);
    } else if (field === 4 && handlers.relation) parseRelation(pbf, messageEnd, context, handlers);
    pbf.pos = messageEnd;
  }
}

function tagsFrom(keys: number[], values: number[], context: BlockContext): Tags | undefined {
  if (!keys.some((key) => context.keyIndices.has(key))) return undefined;
  const tags: Tags = {};
  keys.forEach((key, index) => {
    tags[context.strings[key] ?? ""] = context.strings[values[index] ?? 0] ?? "";
  });
  return tags;
}

function parseNode(pbf: PbfReader, end: number, context: BlockContext, handlers: PbfHandlers) {
  let id = 0;
  let lat = 0;
  let lon = 0;
  const keys: number[] = [];
  const values: number[] = [];
  for (let field; (field = pbf.nextField(end));) {
    if (field === 1) id = pbf.readSVarint();
    else if (field === 2) pbf.readPackedVarint(keys);
    else if (field === 3) pbf.readPackedVarint(values);
    else if (field === 8) lat = pbf.readSVarint();
    else if (field === 9) lon = pbf.readSVarint();
  }
  handlers.node?.(
    id,
    context.latOffset + context.granularity * lat,
    context.lonOffset + context.granularity * lon,
    tagsFrom(keys, values, context),
  );
}

function parseDenseNodes(
  pbf: PbfReader,
  end: number,
  context: BlockContext,
  handlers: PbfHandlers,
) {
  let ids: number[] = [];
  let lats: number[] = [];
  let lons: number[] = [];
  let keysVals: number[] = [];
  for (let field; (field = pbf.nextField(end));) {
    if (field === 1) ids = pbf.readPackedSVarint();
    else if (field === 8) lats = pbf.readPackedSVarint();
    else if (field === 9) lons = pbf.readPackedSVarint();
    else if (field === 10) keysVals = pbf.readPackedVarint();
  }
  let id = 0;
  let lat = 0;
  let lon = 0;
  let kv = 0;
  for (let index = 0; index < ids.length; index++) {
    id += ids[index] ?? 0;
    lat += lats[index] ?? 0;
    lon += lons[index] ?? 0;
    let tags: Tags | undefined;
    if (kv < keysVals.length) {
      const startKv = kv;
      let interesting = false;
      while (kv < keysVals.length && keysVals[kv] !== 0) {
        if (context.keyIndices.has(keysVals[kv] ?? -1)) interesting = true;
        kv += 2;
      }
      if (interesting) {
        tags = {};
        for (let k = startKv; k < kv; k += 2) {
          tags[context.strings[keysVals[k] ?? 0] ?? ""] =
            context.strings[keysVals[k + 1] ?? 0] ?? "";
        }
      }
      kv++;
    }
    handlers.node?.(
      id,
      context.latOffset + context.granularity * lat,
      context.lonOffset + context.granularity * lon,
      tags,
    );
  }
}

function parseWay(pbf: PbfReader, end: number, context: BlockContext, handlers: PbfHandlers) {
  let id = 0;
  const keys: number[] = [];
  const values: number[] = [];
  let refsStart = -1;
  for (let field; (field = pbf.nextField(end));) {
    if (field === 1) id = pbf.readVarint();
    else if (field === 2) pbf.readPackedVarint(keys);
    else if (field === 3) pbf.readPackedVarint(values);
    else if (field === 8) refsStart = pbf.pos;
  }
  const tags = tagsFrom(keys, values, context);
  if (handlers.wantWay && !handlers.wantWay(id, tags)) return;
  const refs: number[] = [];
  if (refsStart >= 0) {
    pbf.pos = refsStart;
    pbf.type = 2;
    let ref = 0;
    for (const delta of pbf.readPackedSVarint()) refs.push((ref += delta));
  }
  handlers.way?.(id, refs, tags);
}

function parseRelation(pbf: PbfReader, end: number, context: BlockContext, handlers: PbfHandlers) {
  let id = 0;
  const keys: number[] = [];
  const values: number[] = [];
  let roles: number[] = [];
  let memberIds: number[] = [];
  let types: number[] = [];
  for (let field; (field = pbf.nextField(end));) {
    if (field === 1) id = pbf.readVarint();
    else if (field === 2) pbf.readPackedVarint(keys);
    else if (field === 3) pbf.readPackedVarint(values);
    else if (field === 8) roles = pbf.readPackedVarint(undefined, true);
    else if (field === 9) memberIds = pbf.readPackedSVarint();
    else if (field === 10) types = pbf.readPackedVarint();
  }
  const tags = tagsFrom(keys, values, context);
  if (!tags) return handlers.relation?.(id, [], undefined);
  let ref = 0;
  const members = memberIds.map((delta, index) => ({
    type: memberTypes[types[index] ?? 0] ?? "node",
    ref: (ref += delta),
    role: context.strings[roles[index] ?? 0] ?? "",
  }));
  handlers.relation?.(id, members, tags);
}
