import type { UpgradeableStat } from '@tankquest/shared';

import type { CombatProfile } from './combat-profile.js';

export interface UpgradeEffect {
  after: number;
  before: number;
  labelKey: string;
}

const effectFields: Record<
  UpgradeableStat,
  Array<{ field: keyof CombatProfile; labelKey: string }>
> = {
  firepower: [
    { field: 'damage', labelKey: 'stat.shell' },
    { field: 'penetration', labelKey: 'stat.penetration' },
    { field: 'projectileSpeed', labelKey: 'stat.projectileSpeed' },
    { field: 'reloadSeconds', labelKey: 'stat.reload' },
  ],
  mobility: [
    { field: 'topSpeed', labelKey: 'stat.speed' },
    { field: 'acceleration', labelKey: 'stat.acceleration' },
    { field: 'turnSpeed', labelKey: 'stat.turnSpeed' },
  ],
  armor: [
    { field: 'health', labelKey: 'stat.health' },
    { field: 'frontArmor', labelKey: 'stat.armor' },
    { field: 'mass', labelKey: 'stat.mass' },
  ],
  stealth: [{ field: 'visibilityPercent', labelKey: 'stat.visibility' }],
  vision: [{ field: 'detectionRange', labelKey: 'stat.detection' }],
  accuracy: [
    { field: 'dispersionRadius', labelKey: 'stat.dispersion' },
    { field: 'gunElevationDegrees', labelKey: 'stat.gunElevation' },
  ],
  turretTraverse: [
    { field: 'turretTraverseDegrees', labelKey: 'stat.turretTraverse' },
  ],
};

export function upgradeEffects(
  before: CombatProfile,
  after: CombatProfile,
  stat: UpgradeableStat
): UpgradeEffect[] {
  return effectFields[stat].map(({ field, labelKey }) => ({
    labelKey,
    before: before[field],
    after: after[field],
  }));
}
