import type { TankStats } from '@tankquest/shared';

const statKeys: Array<keyof TankStats> = [
  'firepower',
  'mobility',
  'armor',
  'stealth',
  'vision',
];

export function applyTankUpgrades(
  baseStats: TankStats,
  upgrades: Array<{ statKey: string; level: number }>
): TankStats {
  const effectiveStats = { ...baseStats };

  for (const upgrade of upgrades) {
    if (!isStatKey(upgrade.statKey) || upgrade.level <= 0) continue;
    effectiveStats[upgrade.statKey] = Math.min(
      5,
      effectiveStats[upgrade.statKey] + upgrade.level
    );
  }

  return effectiveStats;
}

function isStatKey(value: string): value is keyof TankStats {
  return statKeys.some((key) => key === value);
}
