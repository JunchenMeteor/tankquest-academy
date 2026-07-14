import type { TankStats } from '@tankquest/shared';

import type { PlayerRuntimeConfig } from '../runtime/types.js';

export const baselineTankStats: TankStats = {
  firepower: 3,
  mobility: 3,
  armor: 3,
  stealth: 3,
  vision: 3,
};

export function deriveCombatStats(stats: TankStats): PlayerRuntimeConfig {
  const firepower = normalizedLevel(stats.firepower);
  const mobility = normalizedLevel(stats.mobility);
  const armor = normalizedLevel(stats.armor);
  const stealth = normalizedLevel(stats.stealth);
  const vision = normalizedLevel(stats.vision);

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
    fireCooldownMs: 350 - (firepower - 3) * 35,
    detectionRange: 280 + (vision - 3) * 35,
    visibilityMultiplier: 0.88 - (stealth - 3) * 0.06,
  };
}

function normalizedLevel(value: number) {
  if (!Number.isFinite(value)) return 3;
  return Math.min(5, Math.max(1, Math.round(value)));
}
