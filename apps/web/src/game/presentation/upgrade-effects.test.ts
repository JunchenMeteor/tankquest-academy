import { describe, expect, it } from 'vitest';

import { combatProfileForStats } from './combat-profile.js';
import { upgradeEffects } from './upgrade-effects.js';

const baseStats = {
  firepower: 3,
  mobility: 3,
  armor: 3,
  stealth: 3,
  vision: 3,
  accuracy: 3,
  turretTraverse: 3,
};

describe('upgradeEffects', () => {
  it('shows measurable heavy-tank armor gains beyond the old cap', () => {
    const before = combatProfileForStats({ ...baseStats, armor: 5 });
    const after = combatProfileForStats({ ...baseStats, armor: 6 });

    expect(upgradeEffects(before, after, 'armor')).toEqual([
      { labelKey: 'stat.health', before: 200, after: 225 },
      { labelKey: 'stat.armor', before: 102, after: 114 },
      { labelKey: 'stat.mass', before: 140, after: 155 },
    ]);
  });

  it('shows gun handling gains for newly upgradeable stats', () => {
    const before = combatProfileForStats(baseStats);
    const after = combatProfileForStats({
      ...baseStats,
      accuracy: 4,
      turretTraverse: 4,
    });

    expect(upgradeEffects(before, after, 'accuracy')).toEqual([
      { labelKey: 'stat.dispersion', before: 0.168, after: 0.129 },
      { labelKey: 'stat.gunElevation', before: 56.7, after: 67 },
    ]);
    expect(upgradeEffects(before, after, 'turretTraverse')).toEqual([
      { labelKey: 'stat.turretTraverse', before: 118, after: 142.1 },
    ]);
  });
});
