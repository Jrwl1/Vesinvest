import React from 'react';
import type { VeetiLinkStatus } from '../../api';

type Props = {
  status: VeetiLinkStatus | null;
};

export const VeetiStatusBadge: React.FC<Props> = ({ status }) => {
  if (!status || !status.connected) {
    return <span className="veeti-status-badge disconnected">VEETI: ei yhdistetty</span>;
  }

  const dateText = status.lastFetchedAt
    ? new Date(status.lastFetchedAt).toLocaleDateString('fi-FI')
    : 'ei vielä haettu';

  return (
    <span className="veeti-status-badge connected" title={status.nimi ?? undefined}>
      {`VEETI: ${status.nimi ?? status.veetiId ?? 'yhdistetty'} (${dateText})`}
    </span>
  );
};

