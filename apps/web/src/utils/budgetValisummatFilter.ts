/**
 * Filter for KVA-imported valisummat to prevent double-counting in the Budget page UI.
 *
 * KVA workbooks can contain both service-level splits (vesi, jatevesi) and an org-level total
 * ("KVA totalt") stored as palvelutyyppi 'muu'. If we show all three, revenue/expenses are
 * roughly 2x (vesi + jatevesi + muu where muu ≈ vesi + jatevesi).
 *
 * This filter: for each (tyyppi, categoryKey), if there is any valisumma with palvelutyyppi
 * in ['vesi','jatevesi'], exclude valisummat with palvelutyyppi === 'muu' for that same
 * (tyyppi, categoryKey). Keep 'muu' for categoryKeys that have no service splits.
 *
 * Deterministic: same input → same output. Apply before building display rows and section totals.
 */

export type ValisummaLike = {
  tyyppi: string;
  categoryKey: string;
  palvelutyyppi: string;
  summa: string | number;
  [k: string]: unknown;
};

const SERVICE_SPLITS = new Set<string>(['vesi', 'jatevesi']);

/**
 * Returns valisummat with 'muu' rows excluded for (tyyppi, categoryKey) that have at least one
 * vesi or jatevesi row, so org-level totals are not added on top of service splits.
 */
export function filterValisummatNoKvaTotaltDoubleCount<T extends ValisummaLike>(valisummat: T[]): T[] {
  const key = (v: ValisummaLike) => `${v.tyyppi}\0${v.categoryKey}`;
  const hasServiceSplit = new Set<string>();
  for (const v of valisummat) {
    if (SERVICE_SPLITS.has(String(v.palvelutyyppi || '').toLowerCase())) {
      hasServiceSplit.add(key(v));
    }
  }
  return valisummat.filter((v) => {
    const k = key(v);
    const isMuu = String(v.palvelutyyppi || '').toLowerCase() === 'muu';
    if (isMuu && hasServiceSplit.has(k)) return false;
    return true;
  });
}
