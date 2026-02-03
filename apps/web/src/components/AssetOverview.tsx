import React, { useMemo } from 'react';
import type { Asset, Site } from '../types';
import { formatCurrency } from '../utils/format';

interface AssetOverviewProps {
  assets: Asset[];
  sites: Site[];
  loading: boolean;
  onAssetClick?: (assetId: string) => void;
}

type UrgencyLevel = 'ok' | 'upcoming' | 'overdue';

interface AssetWithUrgency extends Asset {
  urgency: UrgencyLevel;
  yearsUntilReplacement: number | null;
}

interface SiteGroup {
  site: Site;
  assets: AssetWithUrgency[];
  totalValue: number;
  overdueCount: number;
  upcomingCount: number;
  okCount: number;
}

const currentYear = new Date().getFullYear();

/**
 * Determine urgency level based on expected replacement year.
 * - Overdue: replacement year is past or current year
 * - Upcoming: within 3 years
 * - OK: more than 3 years away
 */
function getUrgency(asset: Asset): { urgency: UrgencyLevel; yearsUntil: number | null } {
  const replYear = asset.expectedReplacementYear;
  if (!replYear) {
    return { urgency: 'ok', yearsUntil: null };
  }
  
  const yearsUntil = replYear - currentYear;
  
  if (yearsUntil <= 0) {
    return { urgency: 'overdue', yearsUntil };
  } else if (yearsUntil <= 3) {
    return { urgency: 'upcoming', yearsUntil };
  } else {
    return { urgency: 'ok', yearsUntil };
  }
}

/**
 * Human-readable urgency label
 */
function getUrgencyLabel(urgency: UrgencyLevel, yearsUntil: number | null): string {
  if (urgency === 'overdue') {
    if (yearsUntil === 0) return 'Due this year';
    return `${Math.abs(yearsUntil!)} year${Math.abs(yearsUntil!) !== 1 ? 's' : ''} overdue`;
  }
  if (urgency === 'upcoming') {
    return `${yearsUntil} year${yearsUntil !== 1 ? 's' : ''} left`;
  }
  if (yearsUntil !== null) {
    return `${yearsUntil} years left`;
  }
  return 'No data';
}

export const AssetOverview: React.FC<AssetOverviewProps> = ({
  assets,
  sites,
  loading,
  onAssetClick,
}) => {
  // Group assets by site with urgency calculations
  const siteGroups = useMemo(() => {
    const siteMap = new Map(sites.map(s => [s.id, s]));
    const groups = new Map<string, SiteGroup>();
    
    // Add urgency to each asset and group by site
    for (const asset of assets) {
      const { urgency, yearsUntil } = getUrgency(asset);
      const assetWithUrgency: AssetWithUrgency = {
        ...asset,
        urgency,
        yearsUntilReplacement: yearsUntil,
      };
      
      const siteId = asset.siteId;
      const site = siteMap.get(siteId);
      if (!site) continue;
      
      if (!groups.has(siteId)) {
        groups.set(siteId, {
          site,
          assets: [],
          totalValue: 0,
          overdueCount: 0,
          upcomingCount: 0,
          okCount: 0,
        });
      }
      
      const group = groups.get(siteId)!;
      group.assets.push(assetWithUrgency);
      group.totalValue += parseFloat(asset.replacementCostEur || '0');
      
      if (urgency === 'overdue') group.overdueCount++;
      else if (urgency === 'upcoming') group.upcomingCount++;
      else group.okCount++;
    }
    
    // Sort assets within each group: overdue first, then upcoming, then by name
    for (const group of groups.values()) {
      group.assets.sort((a, b) => {
        const urgencyOrder = { overdue: 0, upcoming: 1, ok: 2 };
        const urgencyDiff = urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
        if (urgencyDiff !== 0) return urgencyDiff;
        return a.name.localeCompare(b.name);
      });
    }
    
    // Sort groups by overdue count descending, then by site name
    return Array.from(groups.values()).sort((a, b) => {
      if (a.overdueCount !== b.overdueCount) return b.overdueCount - a.overdueCount;
      if (a.upcomingCount !== b.upcomingCount) return b.upcomingCount - a.upcomingCount;
      return a.site.name.localeCompare(b.site.name);
    });
  }, [assets, sites]);

  // Calculate totals
  const totals = useMemo(() => {
    let overdue = 0, upcoming = 0, ok = 0, totalValue = 0;
    for (const group of siteGroups) {
      overdue += group.overdueCount;
      upcoming += group.upcomingCount;
      ok += group.okCount;
      totalValue += group.totalValue;
    }
    return { overdue, upcoming, ok, total: assets.length, totalValue };
  }, [siteGroups, assets.length]);

  if (loading) {
    return <div className="asset-overview loading">Loading your assets...</div>;
  }

  if (assets.length === 0) {
    return (
      <div className="asset-overview empty">
        <div className="empty-message">
          <h3>No assets yet</h3>
          <p>Import your first Excel file to see your infrastructure here.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="asset-overview">
      {/* Summary Banner - The "honest" view */}
      <div className="overview-summary">
        <div className="summary-sentence">
          {totals.overdue > 0 ? (
            <p className="summary-alert">
              <strong>{totals.overdue} asset{totals.overdue !== 1 ? 's' : ''}</strong> need
              {totals.overdue === 1 ? 's' : ''} attention now, 
              worth <strong>{formatCurrency(
                siteGroups.reduce((sum, g) => 
                  sum + g.assets.filter(a => a.urgency === 'overdue')
                    .reduce((s, a) => s + parseFloat(a.replacementCostEur || '0'), 0), 0)
              )}</strong> in replacement costs.
            </p>
          ) : totals.upcoming > 0 ? (
            <p className="summary-caution">
              All assets are within their expected lifetime.{' '}
              <strong>{totals.upcoming}</strong> will need attention in the next 3 years.
            </p>
          ) : (
            <p className="summary-calm">
              All {totals.total} assets are in good standing. No immediate action needed.
            </p>
          )}
        </div>

        <div className="summary-stats">
          <div className={`stat-card ${totals.overdue > 0 ? 'stat-alert' : ''}`}>
            <div className="stat-value">{totals.overdue}</div>
            <div className="stat-label">Overdue</div>
          </div>
          <div className={`stat-card ${totals.upcoming > 0 ? 'stat-caution' : ''}`}>
            <div className="stat-value">{totals.upcoming}</div>
            <div className="stat-label">Upcoming</div>
          </div>
          <div className="stat-card stat-calm">
            <div className="stat-value">{totals.ok}</div>
            <div className="stat-label">OK</div>
          </div>
        </div>
      </div>

      {/* Site Groups */}
      <div className="site-groups">
        {siteGroups.map(group => (
          <SiteGroupCard
            key={group.site.id}
            group={group}
            onAssetClick={onAssetClick}
          />
        ))}
      </div>
    </div>
  );
};

interface SiteGroupCardProps {
  group: SiteGroup;
  onAssetClick?: (assetId: string) => void;
}

const SiteGroupCard: React.FC<SiteGroupCardProps> = ({ group, onAssetClick }) => {
  const [isExpanded, setIsExpanded] = React.useState(
    // Auto-expand if there are overdue assets
    group.overdueCount > 0
  );

  const siteStatus = group.overdueCount > 0 ? 'alert' : 
                     group.upcomingCount > 0 ? 'caution' : 'calm';

  return (
    <div className={`site-group site-group-${siteStatus}`}>
      <div 
        className="site-group-header"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="site-info">
          <h3 className="site-name">{group.site.name}</h3>
          <div className="site-meta">
            {group.assets.length} asset{group.assets.length !== 1 ? 's' : ''} · {formatCurrency(group.totalValue)} total value
          </div>
        </div>
        
        <div className="site-badges">
          {group.overdueCount > 0 && (
            <span className="urgency-badge urgency-overdue">
              {group.overdueCount} overdue
            </span>
          )}
          {group.upcomingCount > 0 && (
            <span className="urgency-badge urgency-upcoming">
              {group.upcomingCount} upcoming
            </span>
          )}
          <span className="expand-indicator">{isExpanded ? '▼' : '▶'}</span>
        </div>
      </div>

      {isExpanded && (
        <div className="site-group-content">
          <div className="asset-cards">
            {group.assets.map(asset => (
              <AssetCard
                key={asset.id}
                asset={asset}
                onClick={onAssetClick ? () => onAssetClick(asset.id) : undefined}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

interface AssetCardProps {
  asset: AssetWithUrgency;
  onClick?: () => void;
}

const AssetCard: React.FC<AssetCardProps> = ({ asset, onClick }) => {
  const urgencyLabel = getUrgencyLabel(asset.urgency, asset.yearsUntilReplacement);
  
  return (
    <div 
      className={`asset-card asset-card-${asset.urgency} ${onClick ? 'clickable' : ''}`}
      onClick={onClick}
    >
      <div className="asset-card-header">
        <span className="asset-card-name">{asset.name}</span>
        <span className={`urgency-indicator urgency-${asset.urgency}`}>
          {asset.urgency === 'overdue' && '●'}
          {asset.urgency === 'upcoming' && '◐'}
          {asset.urgency === 'ok' && '○'}
        </span>
      </div>
      
      <div className="asset-card-body">
        <div className="asset-card-type">{asset.assetType?.name || 'Unknown type'}</div>
        <div className="asset-card-timeline">
          <span className="timeline-label">{urgencyLabel}</span>
          {asset.expectedReplacementYear && (
            <span className="timeline-year">({asset.expectedReplacementYear})</span>
          )}
        </div>
      </div>
      
      <div className="asset-card-footer">
        <span className="asset-card-cost">{formatCurrency(asset.replacementCostEur)}</span>
      </div>
    </div>
  );
};
