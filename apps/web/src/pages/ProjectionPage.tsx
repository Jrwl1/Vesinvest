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

const HORIZON_OPTIONS = [
  { value: 5, label: '5 years' },
  { value: 10, label: '10 years' },
  { value: 20, label: '20 years' },
  { value: 30, label: '30 years' },
];

const currentYear = new Date().getFullYear();

export const ProjectionPage: React.FC = () => {
  const { navigateToAsset } = useNavigation();

  // Sites for dropdown
  const [sites, setSites] = useState<Site[]>([]);
  const [sitesLoading, setSitesLoading] = useState(true);

  // Controls
  const [selectedSiteId, setSelectedSiteId] = useState<string>('');
  const [fromYear, setFromYear] = useState<number>(currentYear);
  const [horizon, setHorizon] = useState<number>(20);

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

  // Run projection
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

  // Calculate totals
  const totals = useMemo(() => {
    if (!projection) return null;
    const totalOpex = projection.rows.reduce((sum, r) => sum + r.opex, 0);
    const totalCapex = projection.rows.reduce((sum, r) => sum + r.capex, 0);
    return {
      opex: totalOpex,
      capex: totalCapex,
      total: totalOpex + totalCapex,
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
        <h2>Budget & Replacement Plan</h2>
      </div>

      {/* Controls */}
      <div className="projection-controls">
        <div className="filter-group">
          <label htmlFor="site-scope">Scope</label>
          <select
            id="site-scope"
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

        <div className="filter-group">
          <label htmlFor="from-year">From Year</label>
          <input
            id="from-year"
            type="number"
            value={fromYear}
            onChange={(e) => setFromYear(Number(e.target.value))}
            className="filter-input filter-input-narrow"
            min={2000}
            max={2100}
          />
        </div>

        <div className="filter-group">
          <label htmlFor="horizon">Horizon</label>
          <select
            id="horizon"
            value={horizon}
            onChange={(e) => setHorizon(Number(e.target.value))}
            className="filter-select"
          >
            {HORIZON_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group filter-group-actions">
          <label>&nbsp;</label>
          <button
            onClick={runProjection}
            disabled={loading}
            className="btn btn-primary"
          >
            {loading ? 'Running...' : 'Run Projection'}
          </button>
        </div>
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

      {/* Results */}
      {projection && totals && (
        <>
          {/* KPI Cards */}
          <div className="kpi-cards">
            <div className="kpi-card">
              <div className="kpi-label">Range</div>
              <div className="kpi-value">
                {projection.fromYear} – {projection.toYear}
              </div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Total OPEX</div>
              <div className="kpi-value kpi-opex">{formatCurrency(totals.opex)}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Total CAPEX</div>
              <div className="kpi-value kpi-capex">{formatCurrency(totals.capex)}</div>
            </div>
            <div className="kpi-card kpi-card-primary">
              <div className="kpi-label">Grand Total</div>
              <div className="kpi-value">{formatCurrency(totals.total)}</div>
            </div>
          </div>

          {/* Actions */}
          <div className="projection-actions">
            <button onClick={exportCsv} className="btn">
              Download CSV
            </button>
            <button onClick={expandAll} className="btn">
              Expand All
            </button>
            <button onClick={collapseAll} className="btn">
              Collapse All
            </button>
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
          <p>Configure the projection parameters above and click "Run Projection".</p>
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
