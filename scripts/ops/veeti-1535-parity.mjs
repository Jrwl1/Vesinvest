import { readFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_FIXTURE = path.resolve("fixtures/veeti/org-1535-reference.json");

function usage() {
  console.log(`VEETI org 1535 parity checker

Usage:
  node scripts/ops/veeti-1535-parity.mjs [--fixture <path>]

Environment:
  VEETI_PARITY_API_BASE   API base URL (default: http://localhost:3000)
  VEETI_PARITY_EMAIL      Login email (default: admin@vesipolku.dev)
  VEETI_PARITY_PASSWORD   Login password (default: admin123)
  VEETI_PARITY_ORG_ID     Optional orgId for login payload
  VEETI_PARITY_FIXTURE    Optional fixture path
`);
}

function parseArgs(argv) {
  const out = {
    fixturePath: process.env.VEETI_PARITY_FIXTURE || DEFAULT_FIXTURE,
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      out.help = true;
      continue;
    }
    if (arg === "--fixture") {
      out.fixturePath = argv[i + 1] || out.fixturePath;
      i += 1;
      continue;
    }
  }

  return out;
}

function toNumber(value) {
  if (value == null) return 0;
  const parsed = Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeRows(rows) {
  return Array.isArray(rows) ? rows : [];
}

async function apiFetch(url, init = {}) {
  const response = await fetch(url, init);
  if (response.ok) {
    return response;
  }
  const details = await response.text().catch(() => "");
  throw new Error(`Request failed (${response.status}) ${url}: ${details}`);
}

async function login(apiBase, email, password, orgId) {
  const payload = { email, password };
  if (orgId) payload.orgId = orgId;

  const response = await apiFetch(`${apiBase}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await response.json();
  const token = body?.accessToken;
  if (!token) {
    throw new Error("Login response did not include accessToken.");
  }
  return token;
}

function evaluateDatasetChecks({ year, dataType, rows, expected, mismatches }) {
  const normalizedRows = normalizeRows(rows);
  if (normalizedRows.length !== Number(expected.rowCount ?? 0)) {
    mismatches.push(
      `${year}/${dataType}: rowCount mismatch expected=${expected.rowCount} actual=${normalizedRows.length}`
    );
  }

  const sums = expected.sums ?? {};
  for (const [field, expectedValue] of Object.entries(sums)) {
    const actual = normalizedRows.reduce(
      (sum, row) => sum + toNumber(row[field]),
      0
    );
    const delta = Math.abs(actual - Number(expectedValue));
    if (delta > 0.01) {
      mismatches.push(
        `${year}/${dataType}/${field}: sum mismatch expected=${expectedValue} actual=${actual}`
      );
    }
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    return;
  }

  const fixtureRaw = await readFile(args.fixturePath, "utf8");
  const fixture = JSON.parse(fixtureRaw);

  const apiBase = (
    process.env.VEETI_PARITY_API_BASE || "http://localhost:3000"
  ).replace(/\/+$/, "");
  const email = process.env.VEETI_PARITY_EMAIL || "admin@vesipolku.dev";
  const password = process.env.VEETI_PARITY_PASSWORD || "admin123";
  const orgId = process.env.VEETI_PARITY_ORG_ID || "";

  const token = await login(apiBase, email, password, orgId);
  const authHeaders = {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
  };

  const statusRes = await apiFetch(`${apiBase}/v2/import/status`, {
    headers: authHeaders,
  });
  const status = await statusRes.json();
  if (!status?.connected) {
    throw new Error("Import status is not connected. Connect VEETI org first.");
  }

  const expectedVeetiId = Number(fixture?.meta?.veetiId);
  const actualVeetiId = Number(status?.link?.veetiId);
  if (Number.isFinite(expectedVeetiId) && expectedVeetiId !== actualVeetiId) {
    throw new Error(
      `Connected VEETI org mismatch: expected ${expectedVeetiId}, got ${actualVeetiId}.`
    );
  }

  const years = Array.isArray(fixture?.years)
    ? fixture.years
        .map((year) => Number(year))
        .filter((year) => Number.isInteger(year))
    : [];
  if (years.length === 0) {
    throw new Error("Fixture does not define any years.");
  }

  const mismatches = [];
  for (const year of years) {
    const yearRes = await apiFetch(`${apiBase}/v2/import/years/${year}/data`, {
      headers: authHeaders,
    });
    const yearData = await yearRes.json();
    const byType = new Map(
      (yearData?.datasets ?? []).map((row) => [row.dataType, row])
    );

    for (const [dataType, expectationByYear] of Object.entries(
      fixture.datasets ?? {}
    )) {
      if (dataType === "verkko") continue;
      const expected = expectationByYear?.[String(year)];
      if (!expected) continue;

      const row = byType.get(dataType);
      evaluateDatasetChecks({
        year,
        dataType,
        rows: row?.effectiveRows,
        expected,
        mismatches,
      });
    }

    const staticNetwork = fixture?.datasets?.verkko?.static;
    if (staticNetwork?.expectedPerImportedYear) {
      const row = byType.get("verkko");
      const actualCount = normalizeRows(row?.effectiveRows).length;
      const expectedCount = Number(staticNetwork.rowCount ?? 0);
      if (actualCount !== expectedCount) {
        mismatches.push(
          `${year}/verkko: rowCount mismatch expected=${expectedCount} actual=${actualCount}`
        );
      }
    }
  }

  if (mismatches.length > 0) {
    console.error("VEETI parity FAILED");
    for (const line of mismatches) {
      console.error(`- ${line}`);
    }
    process.exit(1);
  }

  console.log(
    `VEETI parity PASS (${years.length} year(s), org ${actualVeetiId})`
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
