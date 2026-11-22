// Test-only writer for tiny OSM PBF files, so importer tests run without downloading an extract.
// Writes one header blob and one data blob per element kind, in the usual nodes, ways, relations
// order, with dense nodes and zlib compression like Geofabrik extracts.

import { writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { PbfWriter } from "pbf";

export interface TestNode {
  id: number;
  lat: number;
  lon: number;
  tags?: Record<string, string>;
}
export interface TestWay {
  id: number;
  refs: number[];
  tags?: Record<string, string>;
}
export interface TestRelation {
  id: number;
  members: { type: "node" | "way" | "relation"; ref: number; role: string }[];
  tags?: Record<string, string>;
}

const message = (build: (pbf: PbfWriter) => void) => {
  const pbf = new PbfWriter();
  build(pbf);
  return pbf.finish();
};

const deltas = (values: number[]) => values.map((value, i) => value - (values[i - 1] ?? 0));

function blob(type: string, data: Uint8Array): Buffer {
  const body = message((pbf) => {
    pbf.writeVarintField(2, data.length);
    pbf.writeBytesField(3, deflateSync(data));
  });
  const header = message((pbf) => {
    pbf.writeStringField(1, type);
    pbf.writeVarintField(3, body.length);
  });
  const length = Buffer.alloc(4);
  length.writeUInt32BE(header.length);
  return Buffer.concat([length, header, body]);
}

function primitiveBlock(build: (strings: (s: string) => number) => Uint8Array): Uint8Array {
  const table = [""];
  const index = (s: string) => {
    const found = table.indexOf(s);
    if (found >= 0) return found;
    table.push(s);
    return table.length - 1;
  };
  const group = build(index);
  return message((pbf) => {
    pbf.writeBytesField(
      1,
      message((st) => {
        for (const s of table) st.writeBytesField(1, new TextEncoder().encode(s));
      }),
    );
    pbf.writeBytesField(2, group);
  });
}

export function writeTestPbf(
  path: string,
  data: { nodes: TestNode[]; ways: TestWay[]; relations: TestRelation[]; timestamp?: number },
) {
  const header = message((pbf) => {
    pbf.writeStringField(4, "OsmSchema-V0.6");
    pbf.writeStringField(4, "DenseNodes");
    pbf.writeStringField(16, "write-pbf test");
    if (data.timestamp !== undefined) pbf.writeVarintField(32, data.timestamp);
  });
  const nodes = primitiveBlock((index) =>
    message((group) => {
      group.writeBytesField(
        2,
        message((dense) => {
          dense.writePackedSVarint(1, deltas(data.nodes.map((n) => n.id)));
          dense.writePackedSVarint(8, deltas(data.nodes.map((n) => Math.round(n.lat * 1e7))));
          dense.writePackedSVarint(9, deltas(data.nodes.map((n) => Math.round(n.lon * 1e7))));
          dense.writePackedVarint(
            10,
            data.nodes.flatMap((n) => [
              ...Object.entries(n.tags ?? {}).flatMap(([k, v]) => [index(k), index(v)]),
              0,
            ]),
          );
        }),
      );
    }),
  );
  const ways = primitiveBlock((index) =>
    message((group) => {
      for (const way of data.ways) {
        group.writeBytesField(
          3,
          message((pbf) => {
            const tags = Object.entries(way.tags ?? {});
            pbf.writeVarintField(1, way.id);
            pbf.writePackedVarint(
              2,
              tags.map(([k]) => index(k)),
            );
            pbf.writePackedVarint(
              3,
              tags.map(([, v]) => index(v)),
            );
            pbf.writePackedSVarint(8, deltas(way.refs));
          }),
        );
      }
    }),
  );
  const relations = primitiveBlock((index) =>
    message((group) => {
      for (const relation of data.relations) {
        group.writeBytesField(
          4,
          message((pbf) => {
            const tags = Object.entries(relation.tags ?? {});
            pbf.writeVarintField(1, relation.id);
            pbf.writePackedVarint(
              2,
              tags.map(([k]) => index(k)),
            );
            pbf.writePackedVarint(
              3,
              tags.map(([, v]) => index(v)),
            );
            pbf.writePackedVarint(
              8,
              relation.members.map((m) => index(m.role)),
            );
            pbf.writePackedSVarint(9, deltas(relation.members.map((m) => m.ref)));
            pbf.writePackedVarint(
              10,
              relation.members.map((m) => ["node", "way", "relation"].indexOf(m.type)),
            );
          }),
        );
      }
    }),
  );
  writeFileSync(
    path,
    Buffer.concat([
      blob("OSMHeader", header),
      blob("OSMData", nodes),
      blob("OSMData", ways),
      blob("OSMData", relations),
    ]),
  );
}
