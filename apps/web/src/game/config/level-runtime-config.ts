import {
  levelEnemyConfigSchema,
  type EnemyTankConfigDto,
  type LevelDto,
  type TankDto,
} from '@tankquest/shared';

import {
  baselineTankStats,
  deriveCombatStats,
} from '../systems/combat-stats.js';
import { localTrainingConfig } from './local-training-config.js';

export function levelRuntimeConfig(level: LevelDto, tank?: TankDto) {
  const parsedConfig = levelEnemyConfigSchema.safeParse(level.config);
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
    enemies: parsedConfig.success
      ? parsedConfig.data.enemyTanks.map(toRuntimeEnemy)
      : localTrainingConfig.enemies.slice(0, enemyCount),
  };
}

function toRuntimeEnemy(enemy: EnemyTankConfigDto) {
  const combat = deriveCombatStats(enemy.stats);
  return {
    id: enemy.id,
    role: enemy.role,
    x: enemy.x,
    y: enemy.y,
    maxHealth: combat.maxHealth,
    armorReduction: combat.armorReduction,
    mass: combat.mass,
    speed: Math.round(combat.speed * enemy.ai.speedMultiplier),
    detectionRange: enemy.ai.detectionRange,
    attackRange: enemy.ai.attackRange,
    projectileDamage: Math.round(combat.projectileDamage * 0.55),
    projectileSpeed: Math.round(combat.projectileSpeed * 0.75),
    fireCooldownMs: enemy.ai.fireCooldownMs,
  };
}
