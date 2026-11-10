import { emptyTankUpgradeLevels } from '@tankquest/shared';
import { describe, expect, it } from 'vitest';

import { applyTankUpgrades, readTankUpgradeLevels } from './tank-upgrades.js';

const baseStats = {
  firepower: 3,
  mobility: 3,
  armor: 5,
  stealth: 3,
  vision: 3,
  accuracy: 3,
  turretTraverse: 3,
};

describe('applyTankUpgrades', () => {
  it('applies persisted levels to every effective session stat', () => {
    expect(
      applyTankUpgrades(baseStats, [
        { statKey: 'firepower', level: 1 },
        { statKey: 'mobility', level: 2 },
        { statKey: 'armor', level: 1 },
        { statKey: 'accuracy', level: 2 },
        { statKey: 'turretTraverse', level: 3 },
      ])
    ).toEqual({
      ...baseStats,
      firepower: 4,
      mobility: 5,
      armor: 6,
      accuracy: 5,
      turretTraverse: 6,
    });
  });

  it('ignores unknown stats and caps purchased levels and effective values', () => {
    const levels = readTankUpgradeLevels([
      { statKey: 'unknown', level: 4 },
      { statKey: 'firepower', level: 20 },
      { statKey: 'armor', level: 2 },
    ]);

    expect(levels).toEqual({
      ...emptyTankUpgradeLevels(),
      firepower: 5,
      armor: 2,
    });
    expect(
      applyTankUpgrades(baseStats, [
        { statKey: 'firepower', level: 20 },
        { statKey: 'armor', level: 20 },
      ])
    ).toMatchObject({ firepower: 8, armor: 10 });
  });

  it('keeps database metadata out of effective stats', () => {
    const persistedStats = {
      ...baseStats,
      id: 'stat_internal',
      tankId: 'tank_internal',
    };

    expect(applyTankUpgrades(persistedStats, [])).toEqual(baseStats);
  });
});
