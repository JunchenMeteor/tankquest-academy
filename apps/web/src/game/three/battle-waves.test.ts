import { describe, expect, it } from 'vitest';

import { planWaves } from './battle-waves.js';

describe('enemy waves', () => {
  it('sends everyone at once on easy difficulty', () => {
    expect(planWaves(4, 0)).toEqual([[0, 1, 2, 3]]);
  });

  it('splits the group as difficulty rises', () => {
    const waves = planWaves(4, 1);
    expect(waves.length).toBeGreaterThan(1);
    expect(waves.flat()).toEqual([0, 1, 2, 3]);
  });

  it('keeps small groups together', () => {
    expect(planWaves(2, 1)).toEqual([[0, 1]]);
    expect(planWaves(0, 1)).toEqual([]);
  });
});
