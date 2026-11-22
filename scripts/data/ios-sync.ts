// Copies the bundled data and the shared ranking fixture into the iOS repository, or verifies that
// the copies there are identical.
//
//   pnpm run data:sync-ios -- --ios-repo ../nearby-pharmacies-ios
//   pnpm run data:verify -- --ios-repo ../nearby-pharmacies-ios
//
// Verify exits 1 when a copy is missing or its SHA-256 differs, or when the web manifest does not
// match the files it lists. Options: --region (default fi), --data-dir (default src/data).

import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { dataFileNames, sha256 } from "./output.ts";

/** Paths inside the iOS repo. Both folders are Xcode synchronized groups of their targets. */
export const IOS_DATA_DIR = "NearbyPharmacies/Resources/Data";
export const IOS_FIXTURE_DIR = "NearbyPharmaciesTests/Fixtures";
export const RANKING_FIXTURE = "fixtures/ranking/ranking-v1.json";

export interface CopyPlan {
  source: string;
  target: string;
}

interface Manifest {
  files: Record<string, { path: string; sha256: string } | null>;
}

/** The files to copy, relative to the web repo root and the iOS repo root. */
export function syncPlan(webRoot: string, iosRepo: string, region: string, dataDir: string) {
  const names = dataFileNames(region);
  const manifestPath = join(webRoot, dataDir, names.manifest);
  if (!existsSync(manifestPath))
    throw new Error(`Missing ${manifestPath}; run pnpm run data:import first`);
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Manifest;
  const problems: string[] = [];
  const plan: CopyPlan[] = [];
  for (const entry of Object.values(manifest.files)) {
    if (!entry) continue;
    const source = join(webRoot, dataDir, entry.path);
    if (!existsSync(source))
      problems.push(`web: ${entry.path} is listed in the manifest but missing`);
    else if (sha256(readFileSync(source)) !== entry.sha256) {
      problems.push(`web: ${entry.path} does not match its SHA-256 in ${names.manifest}`);
    }
    plan.push({ source, target: join(iosRepo, IOS_DATA_DIR, entry.path) });
  }
  plan.push({ source: manifestPath, target: join(iosRepo, IOS_DATA_DIR, names.manifest) });
  plan.push({
    source: join(webRoot, RANKING_FIXTURE),
    target: join(iosRepo, IOS_FIXTURE_DIR, "ranking-v1.json"),
  });
  return { plan, problems };
}

export function verifyPlan(plan: readonly CopyPlan[]): string[] {
  const problems: string[] = [];
  for (const { source, target } of plan) {
    if (!existsSync(target)) {
      problems.push(`missing: ${target}`);
      continue;
    }
    const expected = sha256(readFileSync(source));
    const actual = sha256(readFileSync(target));
    if (expected !== actual)
      problems.push(`differs: ${target} (sha256 ${actual}, expected ${expected})`);
  }
  return problems;
}

export function runCli(mode: "sync" | "verify", argv: readonly string[], webRoot: string): number {
  const { values } = parseArgs({
    args: argv.filter((arg) => arg !== "--"),
    options: {
      "ios-repo": { type: "string" },
      region: { type: "string", default: "fi" },
      "data-dir": { type: "string", default: "src/data" },
    },
  });
  const iosRepo = values["ios-repo"];
  if (!iosRepo) {
    console.error(
      `data:${mode === "sync" ? "sync-ios" : "verify"}: pass --ios-repo <path to nearby-pharmacies-ios>`,
    );
    return 2;
  }
  if (!existsSync(iosRepo)) {
    console.error(`data:${mode}: iOS repo not found: ${iosRepo}`);
    return 2;
  }
  const { plan, problems } = syncPlan(
    webRoot,
    resolve(iosRepo),
    values.region.toLowerCase(),
    values["data-dir"],
  );
  if (problems.length > 0) {
    for (const problem of problems) console.error(problem);
    return 1;
  }
  if (mode === "sync") {
    for (const { source, target } of plan) {
      mkdirSync(dirname(target), { recursive: true });
      copyFileSync(source, target);
      console.log(`copied ${target}`);
    }
  }
  const differences = verifyPlan(plan);
  for (const difference of differences) console.error(difference);
  if (differences.length === 0) console.log(`data:verify: ${plan.length} file(s) match`);
  return differences.length === 0 ? 0 : 1;
}
