import React from 'react';
import {
  connectVeeti,
  generateVeetiBudgets,
  getVeetiYears,
  searchVeetiOrganizations,
  type VeetiOrganizationSearchHit,
  type VeetiYearInfo,
} from '../api';
import { VeetiConfirmStep } from '../components/VeetiConnect/VeetiConfirmStep';
import { VeetiPreviewStep } from '../components/VeetiConnect/VeetiPreviewStep';
import { VeetiSearchStep } from '../components/VeetiConnect/VeetiSearchStep';

export const VeetiConnectPage: React.FC = () => {
  const [query, setQuery] = React.useState('');
  const [results, setResults] = React.useState<VeetiOrganizationSearchHit[]>([]);
  const [selectedOrg, setSelectedOrg] = React.useState<VeetiOrganizationSearchHit | null>(null);
  const [years, setYears] = React.useState<VeetiYearInfo[]>([]);
  const [selectedYears, setSelectedYears] = React.useState<number[]>([]);
  const [searching, setSearching] = React.useState(false);
  const [connecting, setConnecting] = React.useState(false);
  const [generating, setGenerating] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const handleSearch = React.useCallback(async () => {
    if (query.trim().length < 2) return;
    setSearching(true);
    setError(null);
    try {
      const hits = await searchVeetiOrganizations(query, 25);
      setResults(hits);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Haku epäonnistui');
    } finally {
      setSearching(false);
    }
  }, [query]);

  const handleConnect = React.useCallback(async () => {
    if (!selectedOrg) return;
    setConnecting(true);
    setError(null);
    setMessage(null);
    try {
      const result = await connectVeeti(selectedOrg.Id);
      const yearRows = await getVeetiYears();
      setYears(yearRows.sort((a, b) => b.vuosi - a.vuosi));
      setSelectedYears(yearRows.slice(0, 3).map((row) => row.vuosi));
      setMessage(`Yhdistetty: ${result.linked.nimi ?? result.linked.veetiId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Yhdistäminen epäonnistui');
    } finally {
      setConnecting(false);
    }
  }, [selectedOrg]);

  const handleGenerate = React.useCallback(async () => {
    if (selectedYears.length === 0) return;
    setGenerating(true);
    setError(null);
    setMessage(null);
    try {
      const result = await generateVeetiBudgets(selectedYears);
      setMessage(`Budjetteja luotu/päivitetty: ${result.count}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Budjettien luonti epäonnistui');
    } finally {
      setGenerating(false);
    }
  }, [selectedYears]);

  const toggleYear = React.useCallback((year: number) => {
    setSelectedYears((prev) => (prev.includes(year) ? prev.filter((item) => item !== year) : [...prev, year]));
  }, []);

  return (
    <div className="veeti-connect-page">
      <h2>VEETI-yhteys</h2>
      {error && <div className="alert alert-error">{error}</div>}
      {message && <div className="alert alert-success">{message}</div>}

      <VeetiSearchStep
        query={query}
        onQueryChange={setQuery}
        onSearch={handleSearch}
        loading={searching}
        results={results}
        selectedId={selectedOrg?.Id ?? null}
        onSelect={(org) => setSelectedOrg(org)}
      />

      <VeetiPreviewStep years={years} selectedYears={selectedYears} onToggleYear={toggleYear} />

      <VeetiConfirmStep
        selectedOrg={selectedOrg}
        selectedYears={selectedYears}
        connecting={connecting}
        generating={generating}
        onConnectAndSync={handleConnect}
        onGenerate={handleGenerate}
      />
    </div>
  );
};

