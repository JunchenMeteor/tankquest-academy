import type { RuntimeLevelConfig } from '../runtime/types.js';
import {
  baselineTankStats,
  deriveCombatStats,
} from '../systems/combat-stats.js';

export const localTrainingConfig: RuntimeLevelConfig = {
  locale: 'en',
  width: 960,
  height: 540,
  mapStyle: 'range',
  playerSpawn: { x: 120, y: 270 },
  player: deriveCombatStats(baselineTankStats),
  enemies: [
    {
      id: 'robot_alpha',
      role: 'scout',
      x: 720,
      y: 150,
      maxHealth: 90,
      armorReduction: 0.06,
      armorProfile: { front: 54, side: 42, rear: 32 },
      mass: 75,
      speed: 45,
      detectionRange: 260,
      attackRange: 190,
      projectileDamage: 15,
      projectilePenetration: 57,
      projectileSpeed: 320,
      fireCooldownMs: 1900,
    },
    {
      id: 'robot_bravo',
      role: 'medium',
      x: 760,
      y: 390,
      maxHealth: 110,
      armorReduction: 0.08,
      armorProfile: { front: 78, side: 58, rear: 42 },
      mass: 85,
      speed: 55,
      detectionRange: 280,
      attackRange: 220,
      projectileDamage: 18,
      projectilePenetration: 67,
      projectileSpeed: 340,
      fireCooldownMs: 1700,
    },
  ],
  obstacles: [
    { x: 360, y: 170, width: 50, height: 180 },
    { x: 560, y: 370, width: 180, height: 45 },
  ],
};
