# Backlog

Structured V1 work pool. `docs/SPRINT.md` is the active execution queue.
This file is a user-owned optional parking lot for future work and customer TBDs, not a default protocol input.
Only items that still look genuinely open belong here.

## Epic E1: OS hardening and deterministic execution

- B-101: Enforce strict PLAN/DO/RUNSPRINT/REVIEW mode router in `AGENTS.md`.
- B-102: Align canonical precedence and file permissions with AGENTS contract.
- B-104: Enforce concrete sprint evidence format in DO runs (commit hash + file paths + test/artifact output).

## Epic E3: PDF financing export acceptance

- B-304: Define customer signoff evidence for PDF acceptance.

## Epic E4: Hosted deployment and security gates

- B-402: Define backup/restore and migration controls.

## Epic E5: BudgetPage runtime stability and deterministic release gates

- B-505: Enforce `release-check` deterministic order (`lint -> typecheck -> test`) with PASS evidence.

## Epic E6: KVA Excel import customer workflow (`KVA totalt` -> preview -> Talousarvio write)

- B-609: Post-import product decision: merge Tulot and Ennuste UX under a single Ennuste concept.
- B-610: Optional advanced mode decision for Blad1 account-level import rows (default remains removed).

## Epic E10: Post-refresh trust and accessibility hardening

- B-1009: Add production-facing meta description / low-value SEO cleanup only if it remains user-visible after trust hardening.

## Epic E11: Guided setup wizard and truthful baseline handoff

- B-1109: Preserve detailed year comparison and admin/debug tools behind secondary drill-down surfaces instead of the landing page.
- B-1110: Refresh non-canonical product docs and screenshots after the wizard ships so README/deployment collateral no longer describe the old Overview -> sync entry flow.

## Epic E20: Setup year-intake modernization and per-year QDIS import

- B-2008: Re-audit the year-intake flow end to end with the customer's real 2022 QDIS export PDF.

## Epic E28: Security and performance audit remediation

- B-2808: Define and verify frontend production security headers at the real delivery edge, with repo-visible docs/config kept in sync.

## TBD (Owner: Customer)

- These items are required for final acceptance lock and are non-blocking for execution unless a sprint Stop condition is triggered.
- B-TBD-01: Confirm minimum annual result target for planning acceptance.
- B-TBD-02: Confirm default PDF view preference (combined or split water/wastewater).
- B-TBD-03: Confirm start year for the first mandatory 20-year horizon.
- B-TBD-04: Confirm final business approver for V1 acceptance.
- B-TBD-05: Confirm expected base-fee adjustment cadence.
