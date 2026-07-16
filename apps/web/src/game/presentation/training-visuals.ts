import type Phaser from 'phaser';

import type { RuntimeLevelConfig } from '../runtime/types.js';
import type { ProjectileImpactResult } from '../systems/projectile-impact.js';

export function createTrainingTextures(scene: Phaser.Scene) {
  const graphics = scene.add.graphics();
  graphics.clear().fillStyle(0xeadfbd).fillRect(0, 0, 12, 4);
  graphics.generateTexture('projectile', 12, 4);
  graphics.clear().fillStyle(0xff8b6f).fillRect(0, 0, 12, 4);
  graphics.generateTexture('enemy-projectile', 12, 4);
  graphics.clear().fillStyle(0x74806b).fillRect(0, 0, 32, 32);
  graphics.generateTexture('obstacle', 32, 32);
  graphics.destroy();
}

export function drawEnemyHealth(enemy: Phaser.Physics.Arcade.Sprite) {
  const bar = enemy.getData('healthBar') as Phaser.GameObjects.Graphics;
  const health = enemy.getData('health') as number;
  const maxHealth = enemy.getData('maxHealth') as number;
  const ratio = Math.max(0, health / maxHealth);
  bar.clear();
  bar.fillStyle(0x111911, 0.9).fillRect(enemy.x - 20, enemy.y - 30, 40, 5);
  bar
    .fillStyle(ratio > 0.35 ? 0x7eb668 : 0xdb725e, 1)
    .fillRect(enemy.x - 19, enemy.y - 29, 38 * ratio, 3);
}

export function showDamage(
  scene: Phaser.Scene,
  x: number,
  y: number,
  damage: number
) {
  if (damage <= 0) return;
  const label = scene.add
    .text(x, y - 24, `-${damage}`, {
      color: '#ffd7cf',
      fontFamily: 'sans-serif',
      fontSize: '16px',
      fontStyle: 'bold',
    })
    .setDepth(2_000)
    .setOrigin(0.5);
  scene.tweens.add({
    targets: label,
    y: label.y - 24,
    alpha: 0,
    duration: 500,
    onComplete: () => label.destroy(),
  });
}

export function showProjectileImpact(
  scene: Phaser.Scene,
  x: number,
  y: number,
  impact: ProjectileImpactResult,
  locale: RuntimeLevelConfig['locale'] = 'en'
) {
  const presentation =
    locale === 'zh-CN'
      ? {
          ricochet: { label: '跳弹', color: '#9ee7ff' },
          blocked: { label: '未击穿', color: '#ffe08a' },
          penetrated: { label: `击穿 -${impact.damage}`, color: '#ffd7cf' },
        }[impact.outcome]
      : {
          ricochet: { label: 'Ricochet', color: '#9ee7ff' },
          blocked: { label: 'Blocked', color: '#ffe08a' },
          penetrated: {
            label: `Penetrated -${impact.damage}`,
            color: '#ffd7cf',
          },
        }[impact.outcome];
  const label = scene.add
    .text(x, y - 24, presentation.label, {
      color: presentation.color,
      fontFamily: 'sans-serif',
      fontSize: '16px',
      fontStyle: 'bold',
    })
    .setDepth(2_000)
    .setOrigin(0.5);
  scene.tweens.add({
    targets: label,
    y: label.y - 24,
    alpha: 0,
    duration: 650,
    onComplete: () => label.destroy(),
  });
}

export function destroyEnemyVisual(enemy: Phaser.Physics.Arcade.Sprite) {
  const bar = enemy.getData('healthBar') as Phaser.GameObjects.Graphics;
  const turret = enemy.getData('turret') as Phaser.GameObjects.Image;
  bar.destroy();
  turret.destroy();
  enemy.destroy();
}
