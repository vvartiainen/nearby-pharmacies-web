import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it, vi } from "vitest";
import { IOS_DATA_DIR, IOS_FIXTURE_DIR, runCli } from "./ios-sync.ts";
import { dataFileNames, sha256 } from "./output.ts";

describe("iOS sync and verify", () => {
  const root = mkdtempSync(join(tmpdir(), "ios-sync-"));
  afterAll(() => rmSync(root, { recursive: true, force: true }));
  vi.spyOn(console, "log").mockImplementation(() => {});
  const errors = vi.spyOn(console, "error").mockImplementation(() => {});

  // A web checkout with a small data folder and the real fixture.
  const web = join(root, "web");
  const ios = join(root, "ios");
  const names = dataFileNames("fi");
  mkdirSync(join(web, "src/data"), { recursive: true });
  mkdirSync(join(web, "fixtures/ranking"), { recursive: true });
  mkdirSync(ios);
  cpSync("fixtures/ranking/ranking-v1.json", join(web, "fixtures/ranking/ranking-v1.json"));
  const snapshot = '{"schemaVersion":1,"region":"fi","pharmacies":[\n]}\n';
  const notice = "© OpenStreetMap contributors\n";
  writeFileSync(join(web, "src/data", names.pharmacies), snapshot);
  writeFileSync(join(web, "src/data", names.notice), notice);
  writeFileSync(
    join(web, "src/data", names.manifest),
    JSON.stringify({
      files: {
        pharmacies: { path: names.pharmacies, sha256: sha256(snapshot) },
        places: null,
        notice: { path: names.notice, sha256: sha256(notice) },
      },
    }),
  );
  const args = ["--", "--ios-repo", ios];

  it("fails verification before anything is copied", () => {
    expect(runCli("verify", args, web)).toBe(1);
  });

  it("copies snapshot, manifest, notice and fixture into the documented folders", () => {
    expect(runCli("sync", args, web)).toBe(0);
    expect(readFileSync(join(ios, IOS_DATA_DIR, names.pharmacies), "utf8")).toBe(snapshot);
    expect(readFileSync(join(ios, IOS_DATA_DIR, names.notice), "utf8")).toBe(notice);
    expect(readFileSync(join(ios, IOS_DATA_DIR, names.manifest), "utf8")).toContain(
      names.pharmacies,
    );
    expect(readFileSync(join(ios, IOS_FIXTURE_DIR, "ranking-v1.json"), "utf8")).toBe(
      readFileSync("fixtures/ranking/ranking-v1.json", "utf8"),
    );
    expect(runCli("verify", args, web)).toBe(0);
  });

  it("copies the coverage geometry when the import wrote one", () => {
    const coverage = '{"rings":[],"landBorders":[]}';
    writeFileSync(join(web, "src/data", names.coverage), coverage);
    expect(runCli("verify", args, web)).toBe(1);
    expect(runCli("sync", args, web)).toBe(0);
    expect(readFileSync(join(ios, IOS_DATA_DIR, names.coverage), "utf8")).toBe(coverage);
  });

  it("exits non-zero when an iOS copy differs", () => {
    writeFileSync(join(ios, IOS_DATA_DIR, names.pharmacies), snapshot.replace("[", "[ "));
    expect(runCli("verify", args, web)).toBe(1);
    expect(errors).toHaveBeenLastCalledWith(
      expect.stringMatching(/^differs: .*pharmacies\.fi\.json/),
    );
  });

  it("refuses to sync when the web files do not match their manifest", () => {
    writeFileSync(join(web, "src/data", names.notice), "edited\n");
    expect(runCli("sync", args, web)).toBe(1);
    expect(errors).toHaveBeenLastCalledWith(expect.stringMatching(/does not match its SHA-256/));
  });

  it("requires --ios-repo", () => {
    expect(runCli("verify", [], web)).toBe(2);
  });
});
