import type { TankStats, UpgradeableStat } from '@tankquest/shared';
import { upgradeableStats } from '@tankquest/shared';

const statKeys: UpgradeableStat[] = [...upgradeableStats];

export function applyTankUpgrades(
  baseStats: TankStats,
  upgrades: Array<{ statKey: string; level: number }>
): TankStats {
  const effectiveStats: TankStats = {
    firepower: baseStats.firepower,
    mobility: baseStats.mobility,
    armor: baseStats.armor,
    stealth: baseStats.stealth,
    vision: baseStats.vision,
    accuracy: baseStats.accuracy,
    turretTraverse: baseStats.turretTraverse,
  };

  for (const upgrade of upgrades) {
    if (!isStatKey(upgrade.statKey) || upgrade.level <= 0) continue;
    effectiveStats[upgrade.statKey] = Math.min(
      5,
      effectiveStats[upgrade.statKey] + upgrade.level
    );
  }

  return effectiveStats;
}

function isStatKey(value: string): value is UpgradeableStat {
  return statKeys.some((key) => key === value);
}
