import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
export default function setup() {
  execFileSync(
    process.execPath,
    ["--import", "tsx", resolve("packages/publishing/test-support/admin-e2e.ts")],
    { stdio: "inherit" },
  );
}
