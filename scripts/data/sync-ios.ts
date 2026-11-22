import { runCli } from "./ios-sync.ts";

process.exitCode = runCli("sync", process.argv.slice(2), process.cwd());
