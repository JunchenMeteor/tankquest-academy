import type { RuntimeLevelConfig } from '../runtime/types.js';
import {
  baselineTankStats,
  deriveCombatStats,
} from '../systems/combat-stats.js';

export const localTrainingConfig: RuntimeLevelConfig = {
  width: 960,
  height: 540,
  player: deriveCombatStats(baselineTankStats),
  enemies: [
    {
      id: 'robot_alpha',
      x: 720,
      y: 150,
      maxHealth: 90,
      armorReduction: 0.06,
      mass: 75,
      speed: 45,
      detectionRange: 260,
    },
    {
      id: 'robot_bravo',
      x: 760,
      y: 390,
      maxHealth: 110,
      armorReduction: 0.08,
      mass: 85,
      speed: 55,
      detectionRange: 280,
    },
  ],
  obstacles: [
    { x: 360, y: 170, width: 50, height: 180 },
    { x: 560, y: 370, width: 180, height: 45 },
  ],
};
