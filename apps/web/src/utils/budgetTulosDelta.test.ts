import { describe, it, expect } from 'vitest';
import { computeTulosDelta } from './budgetTulosDelta';

describe('computeTulosDelta', () => {
  it('negative→positive: shows % and improvement', () => {
    const r = computeTulosDelta(-87329, 13897);
    expect(r.deltaEur).toBe(13897 - -87329);
    expect(r.text).toMatch(/\+\d+[,.]\d+ %/);
    expect(r.improvement).toBe('improvement');
  });

  it('both positive: shows % when same sign', () => {
    const r = computeTulosDelta(13897, 10453);
    expect(r.deltaEur).toBe(10453 - 13897);
    expect(r.text).toMatch(/24[,.]\d %/);
    expect(r.improvement).toBe('worsening');
  });

  it('positive→negative: shows % and worsening', () => {
    const r = computeTulosDelta(100, -50);
    expect(r.deltaEur).toBe(-150);
    expect(r.text).toMatch(/[-−]\d+[,.]\d+ %/);
    expect(r.improvement).toBe('worsening');
  });

  it('zero→positive: avoids divide-by-zero, shows —', () => {
    const r = computeTulosDelta(0, 100);
    expect(r.deltaEur).toBe(100);
    expect(r.text).toBe('—');
    expect(r.improvement).toBe('improvement');
  });

  it('zero→zero: neutral', () => {
    const r = computeTulosDelta(0, 0);
    expect(r.deltaEur).toBe(0);
    expect(r.text).toBe('0 %');
    expect(r.improvement).toBe('neutral');
  });
});
