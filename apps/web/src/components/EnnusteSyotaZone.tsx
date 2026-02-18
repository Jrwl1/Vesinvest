import React from 'react';

type EnnusteSyotaZoneProps = {
  heading: string;
  children: React.ReactNode;
};

export const EnnusteSyotaZone: React.FC<EnnusteSyotaZoneProps> = ({ heading, children }) => (
  <section id="ennuste-syota" className="ennuste-zone" aria-labelledby="ennuste-syota-heading" tabIndex={-1}>
    <h2 id="ennuste-syota-heading" className="ennuste-zone__heading">{heading}</h2>
    {children}
  </section>
);
