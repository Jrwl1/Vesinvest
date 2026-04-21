import {
  cleanupTempEngineFiles,
  listTempEngineFiles,
} from "../apps/api/scripts/prisma-client-health.mjs";

async function main() {
  if (process.platform !== "win32") {
    console.log("[prisma-lock] Non-Windows platform, check skipped");
    return;
  }

  const tempEngines = await listTempEngineFiles();

  if (tempEngines.length === 0) {
    console.log("[prisma-lock] OK");
    return;
  }

  console.warn("[prisma-lock] Detected stale Prisma engine temp files, attempting cleanup:");
  const cleanup = await cleanupTempEngineFiles();
  for (const item of cleanup.tempFiles) {
    if (cleanup.failed.some((failedItem) => failedItem.fileName === item)) {
      console.error(` - failed to remove ${item}`);
      continue;
    }
    console.warn(` - removed ${item}`);
  }

  if (cleanup.failed.length > 0) {
    console.error(
      "[prisma-lock] Close Node processes and delete stale query_engine*.tmp files before build."
    );
    process.exit(1);
  }

  console.log("[prisma-lock] OK");
}

main().catch((error) => {
  console.error("[prisma-lock] check failed", error);
  process.exit(1);
});
