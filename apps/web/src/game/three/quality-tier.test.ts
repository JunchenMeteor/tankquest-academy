import { describe, expect, it } from 'vitest';

import {
  chooseTier,
  createFrameSampler,
  downgrade,
  readStoredTier,
  shouldDowngrade,
  tierFromQuery,
} from './quality-tier.js';

describe('quality tiers', () => {
  it('starts weak devices low and strong devices high', () => {
    expect(
      chooseTier({
        cores: 2,
        memoryGb: 2,
        effectiveType: '4g',
        saveData: false,
      })
    ).toBe('low');
    expect(
      chooseTier({
        cores: 8,
        memoryGb: 8,
        effectiveType: '4g',
        saveData: false,
      })
    ).toBe('high');
    expect(
      chooseTier({
        cores: 8,
        memoryGb: 8,
        effectiveType: '3g',
        saveData: false,
      })
    ).toBe('medium');
  });

  it('respects save-data and slow networks', () => {
    expect(
      chooseTier({
        cores: 16,
        memoryGb: 16,
        effectiveType: '4g',
        saveData: true,
      })
    ).toBe('low');
    expect(
      chooseTier({
        cores: 16,
        memoryGb: 16,
        effectiveType: '2g',
        saveData: false,
      })
    ).toBe('low');
  });

  it('only ever downgrades', () => {
    expect(downgrade('high')).toBe('medium');
    expect(downgrade('medium')).toBe('low');
    expect(downgrade('low')).toBe('low');
  });

  it('reads an explicit tier from the query before anything else', () => {
    expect(tierFromQuery('?quality=low')).toBe('low');
    expect(tierFromQuery('?quality=ultra')).toBeNull();
    expect(tierFromQuery('')).toBeNull();
  });

  it('ignores a stored value that is no longer a tier', () => {
    const storage = { getItem: () => 'ultra' };
    expect(readStoredTier(storage)).toBeNull();
    expect(readStoredTier({ getItem: () => 'medium' })).toBe('medium');
  });

  it('calibrates from real frame times', () => {
    const sampler = createFrameSampler(4);
    for (let index = 0; index < 4; index += 1) sampler.add(1 / 30);
    expect(sampler.ready).toBe(true);
    expect(sampler.averageFps).toBeCloseTo(30, 0);
    expect(shouldDowngrade('high', sampler.averageFps)).toBe(true);
    expect(shouldDowngrade('low', sampler.averageFps)).toBe(false);
  });
});
