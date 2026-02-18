import { describe, expect, it, beforeEach } from 'vitest';
import {
  getHistoryVolume,
  readHistoryVolumeStore,
  setHistoryVolume,
  writeHistoryVolumeStore,
} from './historyVolumes';

describe('historyVolumes', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('stores and reads per-budget volume as rounded non-negative integer', () => {
    const merged = setHistoryVolume('budget-1', 12345.9);
    expect(merged['budget-1']).toBe(12346);
    expect(getHistoryVolume('budget-1')).toBe(12346);
  });

  it('returns fallback when no value exists', () => {
    expect(getHistoryVolume('missing-budget', 456)).toBe(456);
    expect(getHistoryVolume('missing-budget')).toBeNull();
  });

  it('ignores invalid stored payloads', () => {
    window.localStorage.setItem('ennuste_history_volumes_v1', '{"a":"x","b":10}');
    expect(readHistoryVolumeStore()).toEqual({ b: 10 });

    writeHistoryVolumeStore({ c: 1000 });
    expect(readHistoryVolumeStore()).toEqual({ c: 1000 });
  });
});
