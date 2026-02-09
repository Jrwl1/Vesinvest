import { describe, it, expect } from 'vitest';
import { nextSuffixedName } from './KvaImportPreview';

describe('nextSuffixedName', () => {
  it('appends (2) when name has no suffix', () => {
    expect(nextSuffixedName('KVA 2023')).toBe('KVA 2023 (2)');
    expect(nextSuffixedName('My Random Name')).toBe('My Random Name (2)');
  });

  it('increments suffix when name already has (n)', () => {
    expect(nextSuffixedName('KVA 2023 (2)')).toBe('KVA 2023 (3)');
    expect(nextSuffixedName('KVA 2023 (9)')).toBe('KVA 2023 (10)');
  });

  it('trims whitespace', () => {
    expect(nextSuffixedName('  KVA 2023  ')).toBe('KVA 2023 (2)');
    expect(nextSuffixedName('KVA 2023 (2) ')).toBe('KVA 2023 (3)');
  });
});
