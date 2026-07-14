import type Phaser from 'phaser';

export function createTrainingTextures(scene: Phaser.Scene) {
  const graphics = scene.add.graphics();
  graphics.fillStyle(0x5d7d46).fillRoundedRect(0, 0, 52, 34, 8);
  graphics.generateTexture('tank-body', 52, 34);
  graphics.clear().fillStyle(0xe8c65a).fillRoundedRect(0, 0, 42, 10, 5);
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
