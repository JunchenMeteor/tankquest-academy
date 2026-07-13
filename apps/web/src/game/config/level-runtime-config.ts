import type { LevelDto, TankDto } from '@tankquest/shared';

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

  const firepowerDelta = (tank?.stats.firepower ?? 3) - 3;
  const mobilityDelta = (tank?.stats.mobility ?? 3) - 3;

  return {
    ...localTrainingConfig,
    player: {
      ...localTrainingConfig.player,
      speed: localTrainingConfig.player.speed + mobilityDelta * 18,
      turnSpeed: localTrainingConfig.player.turnSpeed + mobilityDelta * 0.15,
      projectileSpeed:
        localTrainingConfig.player.projectileSpeed + firepowerDelta * 40,
      fireCooldownMs: Math.max(
        150,
        localTrainingConfig.player.fireCooldownMs - firepowerDelta * 35
      ),
    },
    enemies: localTrainingConfig.enemies.slice(0, enemyCount),
  };
}
