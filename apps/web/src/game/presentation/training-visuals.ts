import type Phaser from 'phaser';

import type { RuntimeLevelConfig } from '../runtime/types.js';
import type { ProjectileImpactResult } from '../systems/projectile-impact.js';

export function drawTrainingMap(
  scene: Phaser.Scene,
  width: number,
  height: number,
  style: RuntimeLevelConfig['mapStyle']
) {
  const graphics = scene.add.graphics().setDepth(-2);
  const colors = {
    range: { ground: 0x263826, marking: 0x607451 },
    gate: { ground: 0x29352d, marking: 0x8d7b4e },
    patrol: { ground: 0x202f32, marking: 0x486b70 },
  }[style];
  graphics.fillStyle(colors.ground).fillRect(0, 0, width, height);
  graphics.lineStyle(2, colors.marking, 0.45);

  if (style === 'range') {
    for (let x = 160; x < width; x += 120)
      graphics.lineBetween(x, 0, x, height);
    graphics.strokeCircle(width - 120, height / 2, 70);
    graphics.strokeCircle(width - 120, height / 2, 35);
  } else if (style === 'gate') {
    graphics.fillStyle(colors.marking, 0.12).fillRect(0, 210, width, 120);
    for (let x = 30; x < width; x += 90) {
      graphics.lineBetween(x, height / 2, x + 45, height / 2);
    }
    graphics.strokeRect(320, 190, 60, 160);
    graphics.strokeRect(545, 135, 60, 270);
  } else {
    for (let x = 0; x < width; x += 96) graphics.lineBetween(x, 0, x, height);
    for (let y = 0; y < height; y += 90) graphics.lineBetween(0, y, width, y);
    graphics.fillStyle(colors.marking, 0.12);
    graphics.fillCircle(300, 270, 115).fillCircle(720, 270, 130);
  }
}

export function createTrainingTextures(
  scene: Phaser.Scene,
  appearance: RuntimeLevelConfig['player']['appearance']
) {
  const graphics = scene.add.graphics();
  graphics
    .fillStyle(appearance?.primaryColor ?? 0x5d7d46)
    .fillRoundedRect(0, 0, 52, 34, 8);
  graphics.generateTexture('tank-body', 52, 34);
  graphics
    .clear()
    .fillStyle(appearance?.secondaryColor ?? 0xe8c65a)
    .fillRoundedRect(0, 0, 42, 10, 5);
  graphics.generateTexture('tank-turret', 42, 10);

  createEnemyTexture(graphics, 'scout', 42, 28, 0xb95b4b);
  createEnemyTexture(graphics, 'medium', 48, 32, 0xa6483c);
  createEnemyTexture(graphics, 'heavy', 56, 38, 0x87372f);

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
    .setDepth(5)
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
  impact: ProjectileImpactResult
) {
  const presentation = {
    ricochet: { label: '跳弹', color: '#9ee7ff' },
    blocked: { label: '未击穿', color: '#ffe08a' },
    penetrated: { label: `击穿 -${impact.damage}`, color: '#ffd7cf' },
  }[impact.outcome];
  const label = scene.add
    .text(x, y - 24, presentation.label, {
      color: presentation.color,
      fontFamily: 'sans-serif',
      fontSize: '16px',
      fontStyle: 'bold',
    })
    .setDepth(5)
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

function createEnemyTexture(
  graphics: Phaser.GameObjects.Graphics,
  role: string,
  width: number,
  height: number,
  color: number
) {
  graphics.clear();
  graphics.fillStyle(0x392522).fillRoundedRect(0, 1, width, height - 2, 5);
  graphics.fillStyle(color).fillRoundedRect(4, 5, width - 8, height - 10, 6);
  graphics.generateTexture(`enemy-${role}-body`, width, height);

  const turretWidth = Math.round(width * 0.82);
  graphics.clear();
  graphics
    .fillStyle(color)
    .fillCircle(10, 6, 6)
    .fillRoundedRect(10, 4, turretWidth - 10, 4, 2);
  graphics.generateTexture(`enemy-${role}-turret`, turretWidth, 12);
}
