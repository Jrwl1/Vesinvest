import { spawn } from "node:child_process";

const API_HEALTH_URL = "http://localhost:3000/health";
const API_START_TIMEOUT_MS = 90000;
const POLL_INTERVAL_MS = 500;

function startProcess(label, args) {
  const child = spawn("pnpm", args, {
    stdio: "inherit",
    shell: true,
    env: process.env,
  });

  child.on("error", (error) => {
    console.error(`[dev-up] Failed to start ${label}: ${error.message}`);
  });

  return child;
}

async function waitForApiReady(apiProcess) {
  const start = Date.now();

  while (Date.now() - start < API_START_TIMEOUT_MS) {
    if (apiProcess.exitCode != null) {
      throw new Error("API process exited before becoming ready.");
    }

    try {
      const response = await fetch(API_HEALTH_URL);
      if (response.ok) return;
    } catch {
      // API not ready yet.
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  throw new Error("Timed out waiting for API readiness.");
}

function terminate(child) {
  if (!child || child.exitCode != null) return;
  child.kill("SIGTERM");
}

async function main() {
  console.log("[dev-up] Starting API first...");
  const api = startProcess("api", ["--filter", "./apps/api", "dev"]);

  let web = null;
  let shuttingDown = false;

  const shutdown = (code = 0) => {
    if (shuttingDown) return;
    shuttingDown = true;
    terminate(web);
    terminate(api);
    process.exitCode = code;
  };

  process.on("SIGINT", () => shutdown(0));
  process.on("SIGTERM", () => shutdown(0));

  api.on("exit", (code) => {
    if (shuttingDown) return;
    if (web && web.exitCode == null) {
      console.error(`[dev-up] API exited (${code ?? 0}), stopping web...`);
      shutdown(code ?? 0);
      return;
    }
    shutdown(code ?? 0);
  });

  try {
    await waitForApiReady(api);
    console.log("[dev-up] API ready, starting web...");
    web = startProcess("web", ["--filter", "./apps/web", "dev"]);
  } catch (error) {
    console.error(`[dev-up] ${error.message}`);
    shutdown(1);
    return;
  }

  web.on("exit", (code) => {
    if (shuttingDown) return;
    console.error(`[dev-up] Web exited (${code ?? 0}), stopping API...`);
    shutdown(code ?? 0);
  });
}

main().catch((error) => {
  console.error(`[dev-up] Unhandled error: ${error.message}`);
  process.exit(1);
});
