const AUTO_SEARCH_MIN_QUERY_LENGTH = 3;
const AUTO_SEARCH_BUSINESS_ID_MIN_LENGTH = 4;
const AUTO_SEARCH_DELAY_MS = 320;
const AUTO_SEARCH_BUSINESS_ID_DELAY_MS = 120;
export const OVERVIEW_RUNTIME_STORAGE_KEY = 'v2_overview_runtime_state';

export const normalizeOrganizationSearchQuery = (value: string): string =>
  value.trim().replace(/\s+/g, ' ');

export const normalizeBusinessIdCandidate = (value: string): string =>
  normalizeOrganizationSearchQuery(value).replace(/[^\d]/g, '');

export const isBusinessIdLikeQuery = (value: string): boolean =>
  /^[\d-\s]+$/.test(normalizeOrganizationSearchQuery(value)) &&
  normalizeBusinessIdCandidate(value).length > 0;

export const getAutoSearchMinLength = (value: string): number =>
  isBusinessIdLikeQuery(value)
    ? AUTO_SEARCH_BUSINESS_ID_MIN_LENGTH
    : AUTO_SEARCH_MIN_QUERY_LENGTH;

export const getAutoSearchDelayMs = (value: string): number =>
  isBusinessIdLikeQuery(value)
    ? AUTO_SEARCH_BUSINESS_ID_DELAY_MS
    : AUTO_SEARCH_DELAY_MS;

export function readOverviewRuntimeState(workspaceKey: string | null): {
  selectedYears: number[];
} {
  if (typeof window === 'undefined') {
    return {
      selectedYears: [],
    };
  }

  try {
    const raw = window.sessionStorage.getItem(OVERVIEW_RUNTIME_STORAGE_KEY);
    if (!raw) {
      return {
        selectedYears: [],
      };
    }
    const parsed = JSON.parse(raw) as {
      workspaceKey?: unknown;
      selectedYears?: unknown;
    };
    const storedWorkspaceKey =
      typeof parsed.workspaceKey === 'string' && parsed.workspaceKey.trim().length > 0
        ? parsed.workspaceKey.trim()
        : null;
    if (storedWorkspaceKey == null || storedWorkspaceKey !== workspaceKey) {
      return {
        selectedYears: [],
      };
    }
    const parseYears = (value: unknown): number[] =>
      Array.isArray(value)
        ? value
            .map((item) => Number(item))
            .filter((item) => Number.isFinite(item))
        : [];
    return {
      selectedYears: parseYears(parsed.selectedYears),
    };
  } catch {
    return {
      selectedYears: [],
    };
  }
}
