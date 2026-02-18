const STORAGE_KEY = 'ennuste_history_volumes_v1';

export type HistoryVolumeStore = Record<string, number>;

function toNonNegativeInt(value: unknown): number | null {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return null;
  return Math.max(0, Math.round(num));
}

export function readHistoryVolumeStore(): HistoryVolumeStore {
  if (typeof window === 'undefined' || !window.localStorage) return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const next: HistoryVolumeStore = {};
    for (const [budgetId, value] of Object.entries(parsed)) {
      const safe = toNonNegativeInt(value);
      if (safe != null) next[budgetId] = safe;
    }
    return next;
  } catch {
    return {};
  }
}

export function writeHistoryVolumeStore(store: HistoryVolumeStore): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Ignore storage failures (private mode/quota etc).
  }
}

export function setHistoryVolume(budgetId: string, value: number): HistoryVolumeStore {
  const safe = toNonNegativeInt(value);
  const current = readHistoryVolumeStore();
  if (!budgetId || safe == null) return current;
  const next = { ...current, [budgetId]: safe };
  writeHistoryVolumeStore(next);
  return next;
}

export function getHistoryVolume(
  budgetId: string | null | undefined,
  fallback?: number | null,
): number | null {
  if (!budgetId) return fallback ?? null;
  const store = readHistoryVolumeStore();
  if (typeof store[budgetId] === 'number') return store[budgetId];
  return fallback ?? null;
}
