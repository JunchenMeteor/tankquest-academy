import type { LevelDto } from '@tankquest/shared';

import { localTrainingConfig } from './local-training-config.js';

export function levelRuntimeConfig(level: LevelDto) {
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
    enemies: localTrainingConfig.enemies.slice(0, enemyCount),
  };
}
