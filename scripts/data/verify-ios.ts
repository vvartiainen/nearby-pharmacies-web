import { runCli } from "./ios-sync.ts";

process.exitCode = runCli("verify", process.argv.slice(2), process.cwd());
