import { execFileSync } from "node:child_process";

const DEFAULT_PORTS = [3000, 5173];
const WAIT_AFTER_TERM_MS = 400;
const WAIT_AFTER_KILL_MS = 250;

function parsePorts(argv) {
  const raw = argv.find((arg) => arg.startsWith("--ports="));
  if (!raw) return DEFAULT_PORTS;

  const parsed = raw
    .slice("--ports=".length)
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isInteger(value) && value > 0 && value <= 65535);

  if (parsed.length === 0) {
    throw new Error(
      "No valid ports in --ports argument. Example: --ports=3000,5173"
    );
  }

  return [...new Set(parsed)];
}

function parsePort(localAddress) {
  const separator = localAddress.lastIndexOf(":");
  if (separator === -1 || separator === localAddress.length - 1) return null;

  const port = Number(localAddress.slice(separator + 1));
  return Number.isInteger(port) ? port : null;
}

function getWindowsListeners() {
  const output = execFileSync("netstat", ["-ano", "-p", "tcp"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });

  const byPort = new Map();

  for (const line of output.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("TCP")) continue;

    const columns = trimmed.split(/\s+/);
    if (columns.length < 5) continue;

    const localAddress = columns[1];
    const state = columns[3];
    const pid = Number(columns[4]);

    if (state !== "LISTENING" || !Number.isInteger(pid) || pid <= 0) continue;

    const port = parsePort(localAddress);
    if (!port) continue;

    if (!byPort.has(port)) byPort.set(port, new Set());
    byPort.get(port).add(pid);
  }

  return byPort;
}

function getUnixListenersForPort(port) {
  try {
    const output = execFileSync(
      "lsof",
      ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-t"],
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }
    );

    return new Set(
      output
        .split(/\r?\n/)
        .map((line) => Number(line.trim()))
        .filter((pid) => Number.isInteger(pid) && pid > 0)
    );
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new Error(
        "lsof is required for dev:clean on this platform but was not found."
      );
    }
    if (error.status === 1) {
      return new Set();
    }
    throw error;
  }
}

function getListenersByPort(ports) {
  if (process.platform === "win32") {
    const all = getWindowsListeners();
    const selected = new Map();
    for (const port of ports) {
      selected.set(port, all.get(port) ?? new Set());
    }
    return selected;
  }

  const selected = new Map();
  for (const port of ports) {
    selected.set(port, getUnixListenersForPort(port));
  }
  return selected;
}

function flattenPids(byPort) {
  const pids = new Set();
  for (const listeners of byPort.values()) {
    for (const pid of listeners) {
      if (pid !== process.pid) pids.add(pid);
    }
  }
  return pids;
}

function toPortSummary(byPort) {
  const parts = [];
  for (const [port, pids] of byPort.entries()) {
    const pidText = [...pids].sort((a, b) => a - b).join(", ") || "none";
    parts.push(`${port}=[${pidText}]`);
  }
  return parts.join(" ");
}

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function killPid(pid, signal) {
  try {
    process.kill(pid, signal);
    return true;
  } catch (error) {
    if (error.code === "ESRCH") {
      return true;
    }
    return false;
  }
}

async function main() {
  const ports = parsePorts(process.argv.slice(2));

  const initial = getListenersByPort(ports);
  const initialPids = flattenPids(initial);

  if (initialPids.size === 0) {
    console.log(`[dev:clean] No listeners on ports: ${ports.join(", ")}`);
    return;
  }

  console.log(`[dev:clean] Found listeners: ${toPortSummary(initial)}`);

  for (const pid of initialPids) {
    const ok = killPid(pid, "SIGTERM");
    console.log(`[dev:clean] SIGTERM pid ${pid}: ${ok ? "ok" : "failed"}`);
  }

  await wait(WAIT_AFTER_TERM_MS);

  const afterTerm = getListenersByPort(ports);
  const remainingAfterTerm = flattenPids(afterTerm);
  if (remainingAfterTerm.size > 0) {
    for (const pid of remainingAfterTerm) {
      const ok = killPid(pid, "SIGKILL");
      console.log(`[dev:clean] SIGKILL pid ${pid}: ${ok ? "ok" : "failed"}`);
    }
    await wait(WAIT_AFTER_KILL_MS);
  }

  const final = getListenersByPort(ports);
  const finalPids = flattenPids(final);

  if (finalPids.size > 0) {
    console.error(
      `[dev:clean] Failed to free ports. Remaining: ${toPortSummary(final)}`
    );
    process.exitCode = 1;
    return;
  }

  console.log(`[dev:clean] Freed ports: ${ports.join(", ")}`);
}

main().catch((error) => {
  console.error(`[dev:clean] Error: ${error.message}`);
  process.exit(1);
});
