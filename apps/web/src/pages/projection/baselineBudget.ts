import type { Budget } from '../../api';

function toTimestamp(value?: string | null): number {
  if (!value) return 0;
  const ts = Date.parse(value);
  return Number.isFinite(ts) ? ts : 0;
}

function budgetSortKey(budget: Budget): [number, number, number, number, string] {
  return [
    Number(budget.vuosi ?? 0),
    toTimestamp(budget.importedAt),
    toTimestamp(budget.updatedAt),
    toTimestamp(budget.createdAt),
    String(budget.id ?? ''),
  ];
}

function compareBudgetDesc(a: Budget, b: Budget): number {
  const ak = budgetSortKey(a);
  const bk = budgetSortKey(b);
  for (let i = 0; i < ak.length - 1; i += 1) {
    if (ak[i] !== bk[i]) return Number(bk[i]) - Number(ak[i]);
  }
  return String(ak[4]).localeCompare(String(bk[4]));
}

function pickNewestBudget(candidates: Budget[]): Budget | null {
  if (candidates.length === 0) return null;
  return [...candidates].sort(compareBudgetDesc)[0] ?? null;
}

/**
 * Deterministic baseline selection:
 * 1) prefer the newest importBatchId group, then newest year in that group
 * 2) fallback to newest year globally
 */
export function selectBaselineBudget(budgets: Budget[]): Budget | null {
  if (!Array.isArray(budgets) || budgets.length === 0) return null;

  const withBatch = budgets.filter((budget) => Boolean(budget.importBatchId));
  if (withBatch.length > 0) {
    const grouped = new Map<string, Budget[]>();
    for (const budget of withBatch) {
      const batchId = String(budget.importBatchId);
      const group = grouped.get(batchId) ?? [];
      group.push(budget);
      grouped.set(batchId, group);
    }

    const orderedGroups = [...grouped.entries()].sort((a, b) => {
      const newestA = pickNewestBudget(a[1]);
      const newestB = pickNewestBudget(b[1]);
      const tsA = newestA ? Math.max(toTimestamp(newestA.importedAt), toTimestamp(newestA.updatedAt), toTimestamp(newestA.createdAt)) : 0;
      const tsB = newestB ? Math.max(toTimestamp(newestB.importedAt), toTimestamp(newestB.updatedAt), toTimestamp(newestB.createdAt)) : 0;
      if (tsA !== tsB) return tsB - tsA;
      return a[0].localeCompare(b[0]);
    });

    if (orderedGroups.length > 0) {
      return pickNewestBudget(orderedGroups[0][1]);
    }
  }

  return pickNewestBudget(budgets);
}
