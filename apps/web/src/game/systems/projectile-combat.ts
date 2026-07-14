import type Phaser from 'phaser';

import { showProjectileImpact } from '../presentation/training-visuals.js';
import type { ArmorProfile } from '../runtime/types.js';
import { healthAfterDamage } from './combat-damage.js';
import { logCombatEvent } from './combat-log.js';
import {
  calculateProjectileImpact,
  type ProjectileImpactResult,
} from './projectile-impact.js';

export interface ProjectileResolution {
  health: number;
  impact: ProjectileImpactResult;
}

export function applyProjectileImpact(
  scene: Phaser.Scene,
  projectile: Phaser.Physics.Arcade.Sprite,
  target: Phaser.Physics.Arcade.Sprite,
  armor: ArmorProfile,
  currentHealth: number,
  source: 'enemy' | 'player',
  targetId: string
): ProjectileResolution | undefined {
  if (!projectile.active || !target.active) return undefined;
  const damage = projectile.getData('damage') as unknown;
  const penetration = projectile.getData('penetration') as unknown;
  const body = projectile.body as Phaser.Physics.Arcade.Body | null;
  if (
    typeof damage !== 'number' ||
    !Number.isFinite(damage) ||
    typeof penetration !== 'number' ||
    !Number.isFinite(penetration) ||
    !body
  ) {
    logCombatEvent('invalid_projectile_collision', {
      objectType: projectile.texture.key,
      source,
    });
    return undefined;
  }

  const impact = calculateProjectileImpact({
    armor,
    baseDamage: damage,
    impactOffsetX: projectile.x - target.x,
    impactOffsetY: projectile.y - target.y,
    penetration,
    projectileVelocityX: body.velocity.x,
    projectileVelocityY: body.velocity.y,
    targetRotation: target.rotation,
  });
  projectile.destroy();
  const health = healthAfterDamage(currentHealth, impact.damage);
  showProjectileImpact(scene, target.x, target.y, impact);
  logCombatEvent(
    source === 'player'
      ? 'player_projectile_hit_enemy'
      : 'enemy_projectile_hit_player',
    {
      damage: impact.damage,
      effectiveArmor: impact.effectiveArmor,
      health,
      impactAngle: impact.impactAngleDegrees,
      outcome: impact.outcome,
      penetration: impact.penetration,
      targetId,
      zone: impact.zone,
    }
  );

  return { health, impact };
}
