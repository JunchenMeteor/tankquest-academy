import type { LevelDto, TankDto } from '@tankquest/shared';

import {
  baselineTankStats,
  deriveCombatStats,
} from '../systems/combat-stats.js';
import { localTrainingConfig } from './local-training-config.js';

export function levelRuntimeConfig(level: LevelDto, tank?: TankDto) {
  const configuredCount = level.config.enemyCount;
  const enemyCount =
    typeof configuredCount === 'number' && Number.isInteger(configuredCount)
      ? Math.min(
          Math.max(configuredCount, 1),
          localTrainingConfig.enemies.length
        )
      : localTrainingConfig.enemies.length;

  return {
    ...localTrainingConfig,
    player: deriveCombatStats(tank?.stats ?? baselineTankStats),
    enemies: localTrainingConfig.enemies.slice(0, enemyCount),
  };
}
