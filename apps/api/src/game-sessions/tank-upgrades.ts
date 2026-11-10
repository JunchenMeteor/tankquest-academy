import type {
  TankStats,
  TankUpgradeLevels,
  UpgradeableStat,
} from '@tankquest/shared';
import {
  emptyTankUpgradeLevels,
  tankStatMax,
  tankUpgradeMaxLevel,
  upgradeableStats,
} from '@tankquest/shared';

const statKeys: UpgradeableStat[] = [...upgradeableStats];

export function readTankUpgradeLevels(
  upgrades: Array<{ statKey: string; level: number }>
): TankUpgradeLevels {
  const levels = emptyTankUpgradeLevels();
  for (const upgrade of upgrades) {
    if (!isStatKey(upgrade.statKey) || upgrade.level <= 0) continue;
    levels[upgrade.statKey] = Math.min(
      tankUpgradeMaxLevel,
      Math.floor(upgrade.level)
    );
  }
  return levels;
}

export function applyTankUpgrades(
  baseStats: TankStats,
  upgrades: Array<{ statKey: string; level: number }>
): TankStats {
  const levels = readTankUpgradeLevels(upgrades);
  const effectiveStats: TankStats = {
    firepower: baseStats.firepower,
    mobility: baseStats.mobility,
    armor: baseStats.armor,
    stealth: baseStats.stealth,
    vision: baseStats.vision,
    accuracy: baseStats.accuracy,
    turretTraverse: baseStats.turretTraverse,
  };
  for (const stat of upgradeableStats) {
    effectiveStats[stat] = Math.min(
      tankStatMax,
      effectiveStats[stat] + levels[stat]
    );
  }
  return effectiveStats;
}

function isStatKey(value: string): value is UpgradeableStat {
  return statKeys.some((key) => key === value);
}
