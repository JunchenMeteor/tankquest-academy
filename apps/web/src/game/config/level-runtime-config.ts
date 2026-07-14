import {
  levelEnemyConfigSchema,
  levelMapConfigSchema,
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
  const parsedEnemies = levelEnemyConfigSchema.safeParse(level.config);
  const parsedMap = levelMapConfigSchema.safeParse(level.config.map);
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
    mapStyle: parsedMap.success
      ? parsedMap.data.style
      : localTrainingConfig.mapStyle,
    playerSpawn: parsedMap.success
      ? parsedMap.data.playerSpawn
      : localTrainingConfig.playerSpawn,
    player: {
      ...deriveCombatStats(tank?.stats ?? baselineTankStats),
      ...(tank?.skin
        ? {
            appearance: {
              primaryColor: toPhaserColor(tank.skin.primaryColor, 0x5d7d46),
              secondaryColor: toPhaserColor(tank.skin.secondaryColor, 0xe8c65a),
            },
          }
        : {}),
    },
    enemies: parsedEnemies.success
      ? parsedEnemies.data.enemyTanks.map(toRuntimeEnemy)
      : localTrainingConfig.enemies.slice(0, enemyCount),
    obstacles: parsedMap.success
      ? parsedMap.data.obstacles
      : localTrainingConfig.obstacles,
  };
}

function toPhaserColor(value: string, fallback: number) {
  return /^#[0-9a-f]{6}$/i.test(value)
    ? Number.parseInt(value.slice(1), 16)
    : fallback;
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
    armorProfile: combat.armorProfile,
    mass: combat.mass,
    speed: Math.round(combat.speed * enemy.ai.speedMultiplier),
    detectionRange: enemy.ai.detectionRange,
    attackRange: enemy.ai.attackRange,
    projectileDamage: Math.round(combat.projectileDamage * 0.55),
    projectilePenetration: Math.round(combat.projectilePenetration * 0.82),
    projectileSpeed: Math.round(combat.projectileSpeed * 0.75),
    fireCooldownMs: enemy.ai.fireCooldownMs,
  };
}
