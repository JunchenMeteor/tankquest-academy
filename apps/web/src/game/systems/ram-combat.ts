import type Phaser from 'phaser';

import {
  destroyEnemyVisual,
  showDamage,
} from '../presentation/training-visuals.js';
import type { PlayerRuntimeConfig } from '../runtime/types.js';
import { healthAfterDamage } from './combat-damage.js';
import { logCombatEvent } from './combat-log.js';
import { calculateRamDamage, isRamDamageReady } from './ram-collision.js';

export interface RamResolution {
  enemyId: string;
  enemyDestroyed: boolean;
  playerHealth: number;
}

export function applyRamImpact(
  scene: Phaser.Scene,
  player: Phaser.Physics.Arcade.Sprite,
  enemy: Phaser.Physics.Arcade.Sprite,
  playerConfig: PlayerRuntimeConfig,
  currentPlayerHealth: number,
  lastImpactAt: number | undefined,
  now: number
): RamResolution | undefined {
  if (!player.active || !enemy.active || !isRamDamageReady(lastImpactAt, now)) {
    return undefined;
  }
  const enemyId = enemy.getData('id') as string;
  const damage = calculateRamDamage(
    {
      armorReduction: playerConfig.armorReduction,
      mass: playerConfig.mass,
      velocityX: player.getData('impactVelocityX') as number,
      velocityY: player.getData('impactVelocityY') as number,
      x: player.x,
      y: player.y,
    },
    {
      armorReduction: enemy.getData('armorReduction') as number,
      mass: enemy.getData('mass') as number,
      velocityX: enemy.getData('impactVelocityX') as number,
      velocityY: enemy.getData('impactVelocityY') as number,
      x: enemy.x,
      y: enemy.y,
    }
  );
  if (damage.damageToFirst === 0 && damage.damageToSecond === 0) {
    return undefined;
  }

  const playerHealth = healthAfterDamage(
    currentPlayerHealth,
    damage.damageToFirst
  );
  const enemyHealth = healthAfterDamage(
    enemy.getData('health') as number,
    damage.damageToSecond
  );
  enemy.setData('health', enemyHealth);
  showDamage(scene, player.x, player.y, damage.damageToFirst);
  showDamage(scene, enemy.x, enemy.y, damage.damageToSecond);
  logCombatEvent('ram_impact', {
    damageToEnemy: damage.damageToSecond,
    damageToPlayer: damage.damageToFirst,
    enemyId,
    relativeSpeed: Math.round(damage.relativeSpeed),
  });
  const enemyDestroyed = enemyHealth === 0;
  if (enemyDestroyed) {
    logCombatEvent('enemy_destroyed', { enemyId, source: 'ram' });
    destroyEnemyVisual(enemy);
  }

  return { enemyId, enemyDestroyed, playerHealth };
}
