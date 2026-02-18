import React from 'react';

type EnnusteTuloksetZoneProps = {
  heading: string;
  children: React.ReactNode;
};

export const EnnusteTuloksetZone: React.FC<EnnusteTuloksetZoneProps> = ({ heading, children }) => (
  <section id="ennuste-tulokset" className="ennuste-zone" aria-labelledby="ennuste-tulokset-heading" tabIndex={-1}>
    <h2 id="ennuste-tulokset-heading" className="ennuste-zone__heading">{heading}</h2>
    {children}
  </section>
);
