import React from 'react';

type Props = {
  source?: string | null;
};

export const DataSourceBadge: React.FC<Props> = ({ source }) => {
  const normalized = String(source ?? '').toLowerCase();
  const label = normalized === 'veeti' ? 'VEETI' : 'Manuaalinen';
  const className = normalized === 'veeti' ? 'source-badge source-badge-veeti' : 'source-badge source-badge-manual';
  return <span className={className}>{label}</span>;
};

