import React from 'react';
import type { BenchmarkPeerGroupResult } from '../../api';

type Props = {
  data: BenchmarkPeerGroupResult | null;
};

export const BenchmarkPeerGroup: React.FC<Props> = ({ data }) => {
  if (!data) return <section className="panel">Peer group data unavailable.</section>;

  return (
    <section className="panel">
      <h3>Vertailuryhmä</h3>
      <p>Kokoluokka: <strong>{data.kokoluokka}</strong></p>
      <p>Vertailuorganisaatioita: <strong>{data.peers.length}</strong></p>
    </section>
  );
};

