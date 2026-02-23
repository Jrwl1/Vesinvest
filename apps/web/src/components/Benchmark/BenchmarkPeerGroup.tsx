import React from 'react';
import type { BenchmarkPeerGroupResult } from '../../api';

type Props = {
  data: BenchmarkPeerGroupResult | null;
};

export const BenchmarkPeerGroup: React.FC<Props> = ({ data }) => {
  if (!data) return <section className="panel">Peer group data unavailable.</section>;

  const totalPeers = data.peerCount ?? data.peers.length;

  return (
    <section className="panel">
      <h3>{'Vertailuryhm\u00E4'}</h3>
      <p>
        Kokoluokka: <strong>{data.kokoluokka}</strong>
      </p>
      <p>
        Vertailuorganisaatioita: <strong>{totalPeers}</strong>
      </p>
      {data.peers.length > 0 ? (
        <ul className="benchmark-peer-list">
          {data.peers.slice(0, 8).map((peer) => (
            <li key={`${peer.veetiId}-${peer.ytunnus ?? peer.nimi ?? 'peer'}`}>
              {peer.nimi ?? `VEETI ${peer.veetiId}`}
              {peer.ytunnus ? ` (${peer.ytunnus})` : ''}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
};
