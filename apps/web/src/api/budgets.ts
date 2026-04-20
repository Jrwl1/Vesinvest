import { api } from './core';

export interface BudgetValisumma {
  id: string;
  talousarvioId: string;
  palvelutyyppi: string;
  categoryKey: string;
  tyyppi:
    | 'tulo'
    | 'kulu'
    | 'poisto'
    | 'rahoitus_tulo'
    | 'rahoitus_kulu'
    | 'investointi'
    | 'tulos';
  label: string | null;
  summa: string;
  lahde: string | null;
}

/** API may return partial lines; normalize in BudgetPage before use. */
export type BudgetLineFromApi = Partial<BudgetLine>;

/** API may return partial valisummat; normalize in BudgetPage before use. */
export type BudgetValisummaFromApi = Partial<BudgetValisumma>;

export interface Budget {
  id: string;
  orgId: string;
  vuosi: number;
  nimi: string | null;
  tila: 'luonnos' | 'vahvistettu';
  /** Annual base-fee total (EUR). ADR-013. */
  perusmaksuYhteensa?: number | null;
  lahde?: string | null;
  veetiVuosi?: number | null;
  veetiImportedAt?: string | null;
  userEdited?: boolean;
  importBatchId?: string | null;
  importSourceFileName?: string | null;
  importedAt?: string | null;
  inputCompleteness?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  /** Normalize with normalizeBudgetLine before use; API may omit fields. */
  rivit?: BudgetLine[];
  tuloajurit?: RevenueDriver[];
  /** Normalize with normalizeValisumma before use; API may omit fields. */
  valisummat?: BudgetValisumma[];
  _count?: { rivit: number; tuloajurit: number };
}

export interface BudgetLine {
  id: string;
  talousarvioId: string;
  parentId?: string | null;
  sortOrder?: number;
  rowKind?: 'group' | 'line';
  serviceType?: 'vesi' | 'jatevesi' | 'muu' | null;
  imported?: boolean;
  tiliryhma: string;
  nimi: string;
  tyyppi: 'kulu' | 'tulo' | 'investointi';
  summa: string; // Decimal comes as string from Prisma
  muistiinpanot: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RevenueDriver {
  id: string;
  talousarvioId: string;
  palvelutyyppi: 'vesi' | 'jatevesi' | 'muu';
  yksikkohinta: string;
  myytyMaara: string;
  perusmaksu: string | null;
  liittymamaara: number | null;
  alvProsentti: string | null;
  sourceMeta?: Record<string, unknown> | null;
  muistiinpanot: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Assumption {
  id: string;
  orgId: string;
  avain: string;
  nimi: string;
  arvo: string;
  yksikko: string | null;
  kuvaus: string | null;
  createdAt: string;
  updatedAt: string;
}

// Budgets
export async function listBudgets(): Promise<Budget[]> {
  return api<Budget[]>('/budgets');
}

/** KVA import set (budgets sharing same importBatchId). For Talousarvio set selector. */
export interface BudgetSet {
  batchId: string;
  id: string;
  vuosi: number;
  nimi: string;
  minVuosi?: number;
  maxVuosi?: number;
  yearsCount?: number;
}

export async function getBudgetSets(): Promise<BudgetSet[]> {
  return api<BudgetSet[]>('/budgets/sets');
}

export async function getBudgetsByBatchId(batchId: string): Promise<Budget[]> {
  return api<Budget[]>(`/budgets/sets/${encodeURIComponent(batchId)}`);
}

export async function getBudget(id: string): Promise<Budget> {
  return api<Budget>(`/budgets/${id}`);
}

export async function createBudget(data: {
  vuosi: number;
  nimi?: string;
  perusmaksuYhteensa?: number;
  importBatchId?: string;
}): Promise<Budget> {
  return api<Budget>('/budgets', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export type ValisummaItem = {
  palvelutyyppi: 'vesi' | 'jatevesi' | 'muu';
  categoryKey: string;
  tyyppi:
    | 'tulo'
    | 'kulu'
    | 'poisto'
    | 'rahoitus_tulo'
    | 'rahoitus_kulu'
    | 'investointi'
    | 'tulos';
  summa: number;
  label?: string;
  lahde?: string;
};

export async function updateValisumma(
  budgetId: string,
  valisummaId: string,
  data: { summa: number },
): Promise<BudgetValisumma> {
  return api<BudgetValisumma>(
    `/budgets/${budgetId}/valisummat/${valisummaId}`,
    { method: 'PATCH', body: JSON.stringify(data) },
  );
}

export async function setValisummat(
  budgetId: string,
  items: ValisummaItem[],
): Promise<unknown> {
  return api(`/budgets/${budgetId}/valisummat`, {
    method: 'POST',
    body: JSON.stringify({ items }),
  });
}

export async function updateBudget(
  id: string,
  data: {
    nimi?: string;
    tila?: string;
    perusmaksuYhteensa?: number;
    inputCompleteness?: Record<string, unknown>;
  },
): Promise<Budget> {
  return api<Budget>(`/budgets/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteBudget(id: string): Promise<void> {
  await api(`/budgets/${id}`, { method: 'DELETE' });
}

// Budget Lines
export async function createBudgetLine(
  budgetId: string,
  data: {
    tiliryhma: string;
    nimi: string;
    tyyppi: string;
    summa: number;
    muistiinpanot?: string;
    parentId?: string;
    sortOrder?: number;
    rowKind?: 'group' | 'line';
    serviceType?: 'vesi' | 'jatevesi' | 'muu';
  },
): Promise<BudgetLine> {
  return api<BudgetLine>(`/budgets/${budgetId}/rivit`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateBudgetLine(
  budgetId: string,
  lineId: string,
  data: Record<string, unknown>,
): Promise<BudgetLine> {
  return api<BudgetLine>(`/budgets/${budgetId}/rivit/${lineId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function moveBudgetLine(
  budgetId: string,
  lineId: string,
  data: { parentId?: string | null; sortOrder: number },
): Promise<BudgetLine> {
  return api<BudgetLine>(`/budgets/${budgetId}/rivit/${lineId}/move`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteBudgetLine(
  budgetId: string,
  lineId: string,
): Promise<void> {
  await api(`/budgets/${budgetId}/rivit/${lineId}`, { method: 'DELETE' });
}

// Revenue Drivers
export async function createRevenueDriver(
  budgetId: string,
  data: Record<string, unknown>,
): Promise<RevenueDriver> {
  return api<RevenueDriver>(`/budgets/${budgetId}/tuloajurit`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateRevenueDriver(
  budgetId: string,
  driverId: string,
  data: Record<string, unknown>,
): Promise<RevenueDriver> {
  return api<RevenueDriver>(`/budgets/${budgetId}/tuloajurit/${driverId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteRevenueDriver(
  budgetId: string,
  driverId: string,
): Promise<void> {
  await api(`/budgets/${budgetId}/tuloajurit/${driverId}`, {
    method: 'DELETE',
  });
}

// Assumptions
export async function listAssumptions(): Promise<Assumption[]> {
  return api<Assumption[]>('/assumptions');
}

export async function upsertAssumption(
  avain: string,
  data: { arvo: number; nimi?: string; yksikko?: string; kuvaus?: string },
): Promise<Assumption> {
  return api<Assumption>(`/assumptions/${avain}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function resetAssumptionDefaults(): Promise<Assumption[]> {
  return api<Assumption[]>('/assumptions/reset-defaults', { method: 'POST' });
}

// ============ Projections API ============