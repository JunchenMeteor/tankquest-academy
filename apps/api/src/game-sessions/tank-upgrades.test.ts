import { describe, expect, it } from 'vitest';

import { applyTankUpgrades } from './tank-upgrades.js';

const baseStats = {
  firepower: 3,
  mobility: 3,
  armor: 3,
  stealth: 2,
  vision: 3,
};

describe('applyTankUpgrades', () => {
  it('applies persisted levels to effective session stats', () => {
    expect(
      applyTankUpgrades(baseStats, [
        { statKey: 'firepower', level: 1 },
        { statKey: 'mobility', level: 2 },
      ])
    ).toEqual({ ...baseStats, firepower: 4, mobility: 5 });
  });

  it('ignores unknown stats and caps effective values', () => {
    expect(
      applyTankUpgrades(baseStats, [
        { statKey: 'unknown', level: 4 },
        { statKey: 'firepower', level: 20 },
      ]).firepower
    ).toBe(5);
  });
});
