import type { TankStats } from '@tankquest/shared';

import type { PlayerCombatRuntimeConfig } from '../runtime/types.js';

export const baselineTankStats: TankStats = {
  firepower: 3,
  mobility: 3,
  armor: 3,
  stealth: 3,
  vision: 3,
  accuracy: 3,
  turretTraverse: 3,
};

export function deriveCombatStats(stats: TankStats): PlayerCombatRuntimeConfig {
  const firepower = normalizedLevel(stats.firepower);
  const mobility = normalizedLevel(stats.mobility);
  const armor = normalizedLevel(stats.armor);
  const stealth = normalizedLevel(stats.stealth);
  const vision = normalizedLevel(stats.vision);
  const accuracy = normalizedLevel(stats.accuracy);
  const turretTraverse = normalizedLevel(stats.turretTraverse);

  return {
    maxHealth: 150 + (armor - 3) * 25,
    armorReduction: 0.12 + (armor - 3) * 0.035,
    armorProfile: {
      front: 78 + (armor - 3) * 12,
      side: 58 + (armor - 3) * 8,
      rear: 42 + (armor - 3) * 5,
    },
    mass: 110 + (armor - 3) * 15,
    speed: 170 + (mobility - 3) * 18,
    reverseSpeed: 120 + (mobility - 3) * 14,
    acceleration: 420 + (mobility - 3) * 55,
    turnSpeed: 2.8 + (mobility - 3) * 0.15,
    projectileDamage: 34 + (firepower - 3) * 7,
    projectilePenetration: 82 + (firepower - 3) * 12,
    projectileSpeed: 460 + (firepower - 3) * 40,
    fireCooldownMs:
      350 - (Math.min(firepower, 5) - 3) * 35 - Math.max(0, firepower - 5) * 20,
    detectionRange: 280 + (vision - 3) * 35,
    visibilityMultiplier: 0.88 - (stealth - 3) * 0.06,
    /* Turret traverse comes straight from the tank's own handling stat. */
    turretTraverseSpeed:
      0.8 +
      Math.min(turretTraverse, 5) * 0.42 +
      Math.max(0, turretTraverse - 5) * 0.18,
    /* Elevation follows gun handling, independently of horizontal traverse. */
    gunElevationSpeed: 0.45 + accuracy * 0.18,
    /* Dispersion shrinks as accuracy rises; a heavier gun adds spread. */
    dispersionRadius: Math.max(
      0.02,
      (1.9 -
        Math.min(accuracy, 5) * 0.26 -
        Math.max(0, accuracy - 5) * 0.08 +
        (firepower - 3) * 0.08) *
        0.15
    ),
  };
}

function normalizedLevel(value: number) {
  if (!Number.isFinite(value)) return 3;
  return Math.min(10, Math.max(1, Math.round(value)));
}
