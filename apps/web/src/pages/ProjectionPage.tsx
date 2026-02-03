import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { api } from '../api';
import type { Site } from '../types';
import { formatCurrency } from '../utils/format';
import { useNavigation } from '../context/NavigationContext';

interface ProjectionItem {
  assetId: string;
  assetName: string;
  maintenanceItemId: string | null;
  kind: 'MAINTENANCE' | 'REPLACEMENT';
  cost: number;
  source: string;
}

interface ProjectionRow {
  year: number;
  opex: number;
  capex: number;
  total: number;
  items?: ProjectionItem[];
}

interface ProjectionResponse {
  fromYear: number;
  toYear: number;
  siteId: string | null;
  rows: ProjectionRow[];
}

const currentYear = new Date().getFullYear();

/**
 * Generate a clear, opinionated funding insight based on the projection data.
 * This is the "honest verdict" that replaces spreadsheet guessing.
 */
function generateFundingInsight(
  rows: ProjectionRow[],
  annualBudget?: number
): { verdict: 'healthy' | 'tight' | 'critical'; message: string; details: string } {
  if (rows.length === 0) {
    return {
      verdict: 'healthy',
      message: 'No planned expenses found.',
      details: 'Add maintenance items to your assets to see projections.',
    };
  }

  const totalCost = rows.reduce((sum, r) => sum + r.total, 0);
  const years = rows.length;
  const avgAnnual = totalCost / years;
  
  // Find peak years (years with above-average costs)
  const peakYears = rows.filter(r => r.total > avgAnnual * 1.5);
  const maxYear = rows.reduce((max, r) => r.total > max.total ? r : max, rows[0]);
  
  // Count consecutive high-cost years
  let maxConsecutiveHigh = 0;
  let currentConsecutive = 0;
  for (const row of rows) {
    if (row.total > avgAnnual * 1.2) {
      currentConsecutive++;
      maxConsecutiveHigh = Math.max(maxConsecutiveHigh, currentConsecutive);
    } else {
      currentConsecutive = 0;
    }
  }

  // First 5 years are most critical
  const nearTermCost = rows.slice(0, Math.min(5, rows.length)).reduce((sum, r) => sum + r.total, 0);
  const nearTermYears = Math.min(5, rows.length);
  const nearTermAvg = nearTermCost / nearTermYears;

  // Generate verdict
  if (peakYears.length >= 3 || maxYear.total > avgAnnual * 3) {
    return {
      verdict: 'critical',
      message: `Major investments needed. ${formatCurrency(maxYear.total)} required in ${maxYear.year} alone.`,
      details: `Your infrastructure has ${peakYears.length} high-cost year${peakYears.length !== 1 ? 's' : ''} ahead. ` +
               `Consider spreading replacements or securing additional funding.`,
    };
  }

  if (nearTermAvg > avgAnnual * 1.3 || maxConsecutiveHigh >= 3) {
    return {
      verdict: 'tight',
      message: `Near-term pressure detected. The next 5 years require ${formatCurrency(nearTermCost)}.`,
      details: `Costs are front-loaded. You may need to prioritize or defer some replacements.`,
    };
  }

  // Check if costs are reasonably spread
  const variance = rows.reduce((sum, r) => sum + Math.pow(r.total - avgAnnual, 2), 0) / years;
  const stdDev = Math.sqrt(variance);
  const coefficientOfVariation = stdDev / avgAnnual;

  if (coefficientOfVariation < 0.5) {
    return {
      verdict: 'healthy',
      message: `Costs are well distributed. Average of ${formatCurrency(avgAnnual)} per year.`,
      details: `Your replacement schedule is balanced. Plan for consistent annual budgets.`,
    };
  }

  return {
    verdict: 'healthy',
    message: `Manageable with planning. Total ${formatCurrency(totalCost)} over ${years} years.`,
    details: `Some variation between years, but no critical peaks. ${formatCurrency(avgAnnual)}/year on average.`,
  };
}

export const ProjectionPage: React.FC = () => {
  const { navigateToAsset } = useNavigation();

  // Sites for dropdown
  const [sites, setSites] = useState<Site[]>([]);
  const [sitesLoading, setSitesLoading] = useState(true);

  // Simplified controls - 20-year horizon is the sensible default
  const [selectedSiteId, setSelectedSiteId] = useState<string>('');
  const horizon = 20; // Fixed at 20 years - the standard for water utilities
  const fromYear = currentYear;

  // Results
  const [projection, setProjection] = useState<ProjectionResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Expanded years
  const [expandedYears, setExpandedYears] = useState<Set<number>>(new Set());

  // Fetch sites on mount
  useEffect(() => {
    const fetchSites = async () => {
      try {
        const data = await api<Site[]>('/sites');
        setSites(data);
      } catch (err) {
        console.error('Failed to load sites:', err);
      } finally {
        setSitesLoading(false);
      }
    };
    fetchSites();
  }, []);

  // Auto-run projection on mount and when site changes
  const runProjection = useCallback(async () => {
    setLoading(true);
    setError(null);
    setExpandedYears(new Set());

    try {
      const params = new URLSearchParams();
      params.set('fromYear', String(fromYear));
      params.set('toYear', String(fromYear + horizon - 1));
      params.set('includeDetails', 'true');
      if (selectedSiteId) {
        params.set('siteId', selectedSiteId);
      }

      const data = await api<ProjectionResponse>(`/plans/projection?${params.toString()}`);
      setProjection(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to run projection';
      setError(message);
      setProjection(null);
    } finally {
      setLoading(false);
    }
  }, [fromYear, horizon, selectedSiteId]);

  // Auto-run on mount and site change
  useEffect(() => {
    if (!sitesLoading) {
      runProjection();
    }
  }, [sitesLoading, selectedSiteId, runProjection]);

  // Calculate totals and funding insight
  const { totals, insight } = useMemo(() => {
    if (!projection) return { totals: null, insight: null };
    const totalOpex = projection.rows.reduce((sum, r) => sum + r.opex, 0);
    const totalCapex = projection.rows.reduce((sum, r) => sum + r.capex, 0);
    return {
      totals: {
        opex: totalOpex,
        capex: totalCapex,
        total: totalOpex + totalCapex,
      },
      insight: generateFundingInsight(projection.rows),
    };
  }, [projection]);

  // Export to CSV (includes details)
  const exportCsv = useCallback(() => {
    if (!projection) return;

    const lines: string[] = [];
    lines.push('Year,OPEX (€),CAPEX (€),Total (€)');

    for (const row of projection.rows) {
      lines.push(`${row.year},${row.opex},${row.capex},${row.total}`);
    }

    if (totals) {
      lines.push(`TOTAL,${totals.opex},${totals.capex},${totals.total}`);
    }

    // Add detailed breakdown
    lines.push('');
    lines.push('DETAILED BREAKDOWN');
    lines.push('Year,Asset,Type,Cost (€),Source');

    for (const row of projection.rows) {
      if (row.items && row.items.length > 0) {
        for (const item of row.items) {
          const source = item.source.replace(/,/g, ';'); // Escape commas
          lines.push(`${row.year},"${item.assetName}",${item.kind},${item.cost},"${source}"`);
        }
      }
    }

    const csvContent = lines.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `projection_${fromYear}_${fromYear + horizon - 1}_detailed.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }, [projection, totals, fromYear, horizon]);

  // Toggle year expansion
  const toggleYear = (year: number) => {
    setExpandedYears((prev) => {
      const next = new Set(prev);
      if (next.has(year)) {
        next.delete(year);
      } else {
        next.add(year);
      }
      return next;
    });
  };

  // Expand/collapse all
  const expandAll = () => {
    if (!projection) return;
    const allYears = new Set(projection.rows.map((r) => r.year));
    setExpandedYears(allYears);
  };

  const collapseAll = () => {
    setExpandedYears(new Set());
  };

  // Handle asset click from line item
  const handleAssetClick = (assetId: string) => {
    navigateToAsset(assetId);
  };

  return (
    <div className="projection-page">
      <div className="page-header">
        <div className="page-header-left">
          <h2>20-Year Budget Outlook</h2>
          <span className="page-subtitle">{currentYear} – {currentYear + horizon - 1}</span>
        </div>
        {sites.length > 1 && (
          <div className="site-selector">
            <select
              value={selectedSiteId}
              onChange={(e) => setSelectedSiteId(e.target.value)}
              className="filter-select"
              disabled={sitesLoading}
            >
              <option value="">All sites</option>
              {sites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="error-banner">
          <span className="error-icon">⚠</span>
          <span>{error}</span>
          <button onClick={runProjection} className="btn btn-small">
            Retry
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="loading-state">
          <p>Calculating your 20-year outlook...</p>
        </div>
      )}

      {/* Results */}
      {projection && totals && insight && !loading && (
        <>
          {/* Funding Insight - The "honest verdict" */}
          <div className={`funding-insight insight-${insight.verdict}`}>
            <div className="insight-icon">
              {insight.verdict === 'healthy' && '✓'}
              {insight.verdict === 'tight' && '⚡'}
              {insight.verdict === 'critical' && '!'}
            </div>
            <div className="insight-content">
              <div className="insight-message">{insight.message}</div>
              <div className="insight-details">{insight.details}</div>
            </div>
          </div>

          {/* KPI Cards - Simplified */}
          <div className="kpi-cards">
            <div className="kpi-card">
              <div className="kpi-label">Maintenance (OPEX)</div>
              <div className="kpi-value kpi-opex">{formatCurrency(totals.opex)}</div>
              <div className="kpi-subtext">{formatCurrency(totals.opex / horizon)}/year avg</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Replacements (CAPEX)</div>
              <div className="kpi-value kpi-capex">{formatCurrency(totals.capex)}</div>
              <div className="kpi-subtext">{formatCurrency(totals.capex / horizon)}/year avg</div>
            </div>
            <div className="kpi-card kpi-card-primary">
              <div className="kpi-label">Total Investment</div>
              <div className="kpi-value">{formatCurrency(totals.total)}</div>
              <div className="kpi-subtext">{formatCurrency(totals.total / horizon)}/year avg</div>
            </div>
          </div>

          {/* Actions - Simplified */}
          <div className="projection-actions">
            <button onClick={exportCsv} className="btn btn-secondary">
              Export to Excel
            </button>
            <div className="expand-controls">
              <button onClick={expandAll} className="btn btn-ghost">
                Show Details
              </button>
              <button onClick={collapseAll} className="btn btn-ghost">
                Hide Details
              </button>
            </div>
          </div>

          {/* Table with Expandable Rows */}
          <div className="projection-table-container">
            <table className="projection-table">
              <thead>
                <tr>
                  <th style={{ width: '40px' }}></th>
                  <th>Year</th>
                  <th className="num">OPEX</th>
                  <th className="num">CAPEX</th>
                  <th className="num">Total</th>
                </tr>
              </thead>
              <tbody>
                {projection.rows.map((row) => (
                  <YearRow
                    key={row.year}
                    row={row}
                    isExpanded={expandedYears.has(row.year)}
                    onToggle={() => toggleYear(row.year)}
                    onAssetClick={handleAssetClick}
                  />
                ))}
              </tbody>
              <tfoot>
                <tr className="totals-row">
                  <td></td>
                  <td>
                    <strong>TOTAL</strong>
                  </td>
                  <td className="num">
                    <strong>{formatCurrency(totals.opex)}</strong>
                  </td>
                  <td className="num">
                    <strong>{formatCurrency(totals.capex)}</strong>
                  </td>
                  <td className="num">
                    <strong>{formatCurrency(totals.total)}</strong>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}

      {/* Empty State */}
      {!projection && !loading && !error && (
        <div className="empty-state">
          <div className="empty-icon">📊</div>
          <h3>Your budget outlook will appear here</h3>
          <p>Once you have assets with maintenance schedules, we'll show you exactly what to expect over the next 20 years.</p>
        </div>
      )}
    </div>
  );
};

// Year row component with expansion
interface YearRowProps {
  row: ProjectionRow;
  isExpanded: boolean;
  onToggle: () => void;
  onAssetClick: (assetId: string) => void;
}

const YearRow: React.FC<YearRowProps> = ({ row, isExpanded, onToggle, onAssetClick }) => {
  const hasCapex = row.capex > 0;
  const hasItems = row.items && row.items.length > 0;

  return (
    <>
      <tr
        className={`clickable-row ${hasCapex ? 'row-capex' : ''} ${isExpanded ? 'row-expanded' : ''}`}
        onClick={onToggle}
      >
        <td className="expand-cell">
          {hasItems && (
            <span className="expand-icon">{isExpanded ? '▼' : '▶'}</span>
          )}
        </td>
        <td>
          <span className="year-label">{row.year}</span>
          {hasCapex && <span className="badge-capex">CAPEX</span>}
          {hasItems && (
            <span className="items-count">{row.items!.length} item{row.items!.length !== 1 ? 's' : ''}</span>
          )}
        </td>
        <td className="num">{formatCurrency(row.opex)}</td>
        <td className="num">{formatCurrency(row.capex)}</td>
        <td className="num">{formatCurrency(row.total)}</td>
      </tr>
      {isExpanded && hasItems && (
        <tr className="detail-row">
          <td colSpan={5}>
            <div className="year-items">
              <table className="items-table">
                <thead>
                  <tr>
                    <th>Asset</th>
                    <th>Type</th>
                    <th className="num">Cost</th>
                    <th>Source</th>
                  </tr>
                </thead>
                <tbody>
                  {row.items!.map((item, idx) => (
                    <tr
                      key={`${item.assetId}-${item.maintenanceItemId ?? 'asset'}-${idx}`}
                      className="item-row"
                    >
                      <td>
                        <button
                          className="asset-link"
                          onClick={(e) => {
                            e.stopPropagation();
                            onAssetClick(item.assetId);
                          }}
                        >
                          {item.assetName}
                        </button>
                      </td>
                      <td>
                        <span className={`kind-badge kind-${item.kind.toLowerCase()}`}>
                          {item.kind}
                        </span>
                      </td>
                      <td className="num">{formatCurrency(item.cost)}</td>
                      <td className="source-cell">{item.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      )}
    </>
  );
};
