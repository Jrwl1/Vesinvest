import fs from "node:fs/promises";
import path from "node:path";

async function main() {
  if (process.platform !== "win32") {
    console.log("[prisma-lock] Non-Windows platform, check skipped");
    return;
  }

  const clientDir = path.join(
    process.cwd(),
    "node_modules",
    ".pnpm",
    "@prisma+client@5.22.0_prisma@5.22.0",
    "node_modules",
    ".prisma",
    "client"
  );

  let entries = [];
  try {
    entries = await fs.readdir(clientDir);
  } catch {
    console.log("[prisma-lock] Prisma client directory not found, skipping");
    return;
  }

  const tempEngines = entries.filter((name) =>
    name.startsWith("query_engine-windows.dll.node.tmp")
  );

  if (tempEngines.length === 0) {
    console.log("[prisma-lock] OK");
    return;
  }

  console.error("[prisma-lock] Detected stale Prisma engine temp files:");
  for (const item of tempEngines) {
    console.error(` - ${item}`);
  }
  console.error(
    "[prisma-lock] Close Node processes and delete stale query_engine*.tmp files before build."
  );
  process.exit(1);
}

main().catch((error) => {
  console.error("[prisma-lock] check failed", error);
  process.exit(1);
});
