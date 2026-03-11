import { execFileSync, spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const args = process.argv.slice(2);
const skipPush = args.includes("--skip-push");

function run(command, commandArgs, options = {}) {
  const result = spawnSync(command, commandArgs, {
    cwd: repoRoot,
    stdio: "inherit",
    shell: false,
    ...options,
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function output(command, commandArgs) {
  return execFileSync(command, commandArgs, {
    cwd: repoRoot,
    encoding: "utf8",
  }).trim();
}

function assertCleanMain() {
  const branch = output("git", ["rev-parse", "--abbrev-ref", "HEAD"]);
  if (branch !== "main") {
    console.error(`[deploy] Refusing to deploy from branch "${branch}". Switch to main first.`);
    process.exit(1);
  }

  const status = output("git", ["status", "--porcelain"]);
  if (status.length > 0) {
    console.error("[deploy] Refusing to deploy with a dirty working tree.");
    console.error(status);
    process.exit(1);
  }
}

function pushMain() {
  if (skipPush) {
    console.log("[deploy] Skipping git push (--skip-push)");
    return;
  }
  console.log("[deploy] Pushing origin/main");
  run("git", ["push", "origin", "main"]);
}

function runWindowsDeploy() {
  run("powershell", [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    path.join(__dirname, "deploy-prod.ps1"),
  ]);
}

function runUnixDeploy() {
  run("bash", [path.join(__dirname, "deploy-prod.sh")]);
}

assertCleanMain();
pushMain();

if (process.platform === "win32") {
  runWindowsDeploy();
} else {
  runUnixDeploy();
}
