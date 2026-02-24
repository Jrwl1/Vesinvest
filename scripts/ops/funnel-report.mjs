function required(name, value) {
  if (!value) {
    throw new Error(`Missing required value: ${name}`);
  }
  return value;
}

async function main() {
  const apiBase = (process.env.OPS_API_BASE || "https://api.jrwl.io").replace(
    /\/+$/,
    ""
  );
  const email = required("OPS_EMAIL", process.env.OPS_EMAIL);
  const password = required("OPS_PASSWORD", process.env.OPS_PASSWORD);
  const orgId = process.env.OPS_ORG_ID;

  const loginRes = await fetch(`${apiBase}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, orgId }),
  });
  if (!loginRes.ok) {
    const text = await loginRes.text();
    throw new Error(`Login failed (${loginRes.status}): ${text}`);
  }
  const login = await loginRes.json();
  const token = login?.accessToken;
  if (!token) throw new Error("No access token in login response");

  const funnelRes = await fetch(`${apiBase}/v2/ops/funnel`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });
  if (!funnelRes.ok) {
    const text = await funnelRes.text();
    throw new Error(`Funnel request failed (${funnelRes.status}): ${text}`);
  }

  const data = await funnelRes.json();
  const org = data.organization;
  const system = data.system;

  const connectedPct =
    system.orgCount > 0
      ? ((system.connectedOrgCount / system.orgCount) * 100).toFixed(1)
      : "0.0";
  const importedPct =
    system.connectedOrgCount > 0
      ? ((system.importedOrgCount / system.connectedOrgCount) * 100).toFixed(1)
      : "0.0";
  const scenarioPct =
    system.importedOrgCount > 0
      ? ((system.scenarioOrgCount / system.importedOrgCount) * 100).toFixed(1)
      : "0.0";

  console.log("--- Ops Funnel Snapshot ---");
  console.log(`Computed at: ${data.computedAt}`);
  console.log(
    `Org: connected=${org.connected} years=${org.importedYearCount} ready=${org.syncReadyYearCount} blocked=${org.blockedYearCount}`
  );
  console.log(
    `Org funnel: budgets=${org.veetiBudgetCount} scenarios=${org.scenarioCount} computed=${org.computedScenarioCount} reports=${org.reportCount}`
  );
  console.log(
    `System: connected ${system.connectedOrgCount}/${system.orgCount} (${connectedPct}%)`
  );
  console.log(
    `System: imported ${system.importedOrgCount}/${system.connectedOrgCount} (${importedPct}%)`
  );
  console.log(
    `System: scenarios ${system.scenarioOrgCount}/${system.importedOrgCount} (${scenarioPct}%)`
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
