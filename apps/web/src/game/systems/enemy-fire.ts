import type Phaser from 'phaser';

import { canEnemyFire } from './enemy-ai.js';

export function fireEnemyProjectile(
  scene: Phaser.Scene,
  projectiles: Phaser.Physics.Arcade.Group,
  enemy: Phaser.Physics.Arcade.Sprite,
  turret: Phaser.GameObjects.Image,
  time: number
) {
  const lastShotAt = enemy.getData('lastShotAt') as number;
  const fireCooldownMs = enemy.getData('fireCooldownMs') as number;
  if (!canEnemyFire(lastShotAt, time, fireCooldownMs)) return false;

  const projectile = projectiles.get(turret.x, turret.y, 'enemy-projectile');
  if (!projectile) return false;
  projectile
    .setActive(true)
    .setVisible(true)
    .setData({
      damage: enemy.getData('projectileDamage') as number,
      penetration: enemy.getData('projectilePenetration') as number,
    });
  scene.physics.velocityFromRotation(
    turret.rotation,
    enemy.getData('projectileSpeed') as number,
    projectile.body.velocity
  );
  projectile.setRotation(turret.rotation);
  enemy.setData('lastShotAt', time);
  scene.time.delayedCall(2200, () => {
    if (projectile.active) projectile.destroy();
  });
  return true;
}
