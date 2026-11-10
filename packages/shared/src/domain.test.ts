import { describe, expect, it } from 'vitest';

import {
  emptyTankUpgradeLevels,
  tankUpgradeCost,
  tankUpgradeCosts,
  upgradeableStats,
} from './domain.js';

describe('tank upgrade progression', () => {
  it('offers five escalating purchases for all seven combat stats', () => {
    expect(upgradeableStats).toEqual([
      'firepower',
      'mobility',
      'armor',
      'stealth',
      'vision',
      'accuracy',
      'turretTraverse',
    ]);
    expect(tankUpgradeCosts).toEqual([2, 4, 6, 8, 10]);
    expect(tankUpgradeCosts.map((_, level) => tankUpgradeCost(level))).toEqual(
      tankUpgradeCosts
    );
    expect(tankUpgradeCost(5)).toBeNull();
    expect(tankUpgradeCost(-1)).toBeNull();
    expect(tankUpgradeCost(1.5)).toBeNull();
  });

  it('starts every upgrade track at level zero', () => {
    expect(emptyTankUpgradeLevels()).toEqual({
      firepower: 0,
      mobility: 0,
      armor: 0,
      stealth: 0,
      vision: 0,
      accuracy: 0,
      turretTraverse: 0,
    });
  });
});
