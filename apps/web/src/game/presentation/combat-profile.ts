import type { TankStats } from '@tankquest/shared';

import type { EnemyRuntimeConfig } from '../runtime/types.js';
import { deriveCombatStats } from '../systems/combat-stats.js';

export interface CombatProfile {
  acceleration: number;
  damage: number;
  detectionRange: number;
  dispersionRadius: number;
  frontArmor: number;
  gunElevationDegrees: number;
  health: number;
  mass: number;
  penetration: number;
  projectileSpeed: number;
  reloadSeconds: number;
  topSpeed: number;
  turnSpeed: number;
  turretTraverseDegrees: number;
  visibilityPercent: number;
}

export interface EnemyThreatProfile {
  role: EnemyRuntimeConfig['role'];
  elite: boolean;
  damage: number;
  detectionRange: number;
  frontArmor: number;
  health: number;
  reloadSeconds: number;
  topSpeed: number;
}

export function combatProfileForStats(stats: TankStats): CombatProfile {
  const combat = deriveCombatStats(stats);
  return {
    acceleration: combat.acceleration,
    damage: combat.projectileDamage,
    detectionRange: combat.detectionRange,
    dispersionRadius: Number(combat.dispersionRadius.toFixed(3)),
    frontArmor: combat.armorProfile.front,
    gunElevationDegrees: radiansToDegrees(combat.gunElevationSpeed ?? 0),
    health: combat.maxHealth,
    mass: combat.mass,
    penetration: combat.projectilePenetration,
    projectileSpeed: combat.projectileSpeed,
    reloadSeconds: millisecondsToSeconds(combat.fireCooldownMs),
    topSpeed: combat.speed,
    turnSpeed: Number(combat.turnSpeed.toFixed(2)),
    turretTraverseDegrees: radiansToDegrees(combat.turretTraverseSpeed),
    visibilityPercent: Math.round(combat.visibilityMultiplier * 100),
  };
}

export function enemyCombatProfile(
  enemy: EnemyRuntimeConfig
): EnemyThreatProfile {
  return {
    role: enemy.role,
    elite: enemy.elite,
    damage: enemy.projectileDamage,
    detectionRange: enemy.detectionRange,
    frontArmor: enemy.armorProfile.front,
    health: enemy.maxHealth,
    reloadSeconds: millisecondsToSeconds(enemy.fireCooldownMs),
    topSpeed: enemy.speed,
  };
}

export function enemyThreatProfiles(enemies: EnemyRuntimeConfig[]) {
  return (['scout', 'medium', 'heavy'] as const).flatMap((role) =>
    [false, true].flatMap((elite) => {
      const enemy = enemies.find(
        (candidate) => candidate.role === role && candidate.elite === elite
      );
      return enemy ? [enemyCombatProfile(enemy)] : [];
    })
  );
}

function millisecondsToSeconds(value: number) {
  return Number((value / 1000).toFixed(2));
}

function radiansToDegrees(value: number) {
  return Number(((value * 180) / Math.PI).toFixed(1));
}
