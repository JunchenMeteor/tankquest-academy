import Phaser from 'phaser';

import {
  calculateArmoredDamage,
  healthAfterDamage,
} from '../systems/combat-damage.js';
import { calculateTankMotion } from '../systems/tank-motion.js';
import {
  calculateRamDamage,
  isRamDamageReady,
} from '../systems/ram-collision.js';
import type { RuntimeLevelConfig, RuntimeState } from '../runtime/types.js';

interface ControlKeys {
  up: Phaser.Input.Keyboard.Key;
  down: Phaser.Input.Keyboard.Key;
  left: Phaser.Input.Keyboard.Key;
  right: Phaser.Input.Keyboard.Key;
  fire: Phaser.Input.Keyboard.Key;
}

export class TrainingScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private turret!: Phaser.GameObjects.Image;
  private enemies!: Phaser.Physics.Arcade.Group;
  private projectiles!: Phaser.Physics.Arcade.Group;
  private controls!: ControlKeys;
  private lastShotAt = 0;
  private shotsFired = 0;
  private playerHealth: number;
  private playerDestroyed = false;
  private readonly lastRamAt = new Map<string, number>();

  constructor(
    private readonly levelConfig: RuntimeLevelConfig,
    private readonly onState: (state: RuntimeState) => void
  ) {
    super('training');
    this.playerHealth = levelConfig.player.maxHealth;
  }

  create() {
    this.createTextures();
    this.physics.world.setBounds(
      0,
      0,
      this.levelConfig.width,
      this.levelConfig.height
    );
    this.cameras.main.setBackgroundColor('#263826');

    const obstacles = this.physics.add.staticGroup();
    for (const obstacle of this.levelConfig.obstacles) {
      const sprite = obstacles.create(obstacle.x, obstacle.y, 'obstacle');
      sprite.setDisplaySize(obstacle.width, obstacle.height).refreshBody();
    }

    this.player = this.physics.add.sprite(
      130,
      this.levelConfig.height / 2,
      'tank-body'
    );
    this.player
      .setCollideWorldBounds(true)
      .setDrag(600, 600)
      .setMaxVelocity(220);
    this.player.body?.setMass(this.levelConfig.player.mass);
    this.turret = this.add
      .image(this.player.x, this.player.y, 'tank-turret')
      .setDepth(2);

    this.enemies = this.physics.add.group();
    for (const enemy of this.levelConfig.enemies) {
      const sprite = this.enemies.create(enemy.x, enemy.y, 'training-robot');
      sprite.setData({
        id: enemy.id,
        health: enemy.maxHealth,
        maxHealth: enemy.maxHealth,
        armorReduction: enemy.armorReduction,
        mass: enemy.mass,
        speed: enemy.speed,
        detectionRange: enemy.detectionRange,
        impactVelocityX: 0,
        impactVelocityY: 0,
        healthBar: this.add.graphics().setDepth(3),
      });
      sprite.setCollideWorldBounds(true);
      sprite.body?.setMass(enemy.mass);
    }

    this.projectiles = this.physics.add.group({ maxSize: 24 });
    this.physics.add.collider(this.player, obstacles);
    this.physics.add.collider(this.enemies, obstacles);
    this.physics.add.collider(this.enemies, this.enemies);
    this.physics.add.collider(this.player, this.enemies, (_player, enemy) =>
      this.handleRam(enemy as Phaser.Physics.Arcade.Sprite)
    );
    this.physics.add.collider(this.projectiles, obstacles, (projectile) =>
      projectile.destroy()
    );
    this.physics.add.overlap(
      this.projectiles,
      this.enemies,
      (projectile, enemy) =>
        this.handleProjectileHit(
          projectile as Phaser.Physics.Arcade.Sprite,
          enemy as Phaser.Physics.Arcade.Sprite
        )
    );

    const keyboard = this.input.keyboard;
    if (!keyboard) {
      throw new Error('Keyboard input is unavailable');
    }
    this.controls = keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
      fire: Phaser.Input.Keyboard.KeyCodes.SPACE,
    }) as ControlKeys;
    this.input.on('pointerdown', () => this.fire());
    this.emitState();
  }

  update(time: number, delta: number) {
    if (this.playerDestroyed) return;

    const motion = calculateTankMotion(
      this.player.rotation,
      this.levelConfig.player.speed,
      this.levelConfig.player.turnSpeed,
      {
        forward: this.controls.up.isDown,
        backward: this.controls.down.isDown,
        left: this.controls.left.isDown,
        right: this.controls.right.isDown,
      }
    );
    this.player.setVelocity(motion.velocityX, motion.velocityY);
    this.player.setData({
      impactVelocityX: motion.velocityX,
      impactVelocityY: motion.velocityY,
    });
    this.player.rotation += motion.angularVelocity * (delta / 1000);

    const pointer = this.input.activePointer;
    const worldPoint = pointer.positionToCamera(
      this.cameras.main
    ) as Phaser.Math.Vector2;
    this.turret.setPosition(this.player.x, this.player.y);
    this.turret.rotation = Phaser.Math.Angle.Between(
      this.turret.x,
      this.turret.y,
      worldPoint.x,
      worldPoint.y
    );

    if (
      this.controls.fire.isDown &&
      time - this.lastShotAt >= this.levelConfig.player.fireCooldownMs
    ) {
      this.fire();
    }
    this.updateEnemies();
  }

  private fire() {
    const now = this.time.now;
    if (now - this.lastShotAt < this.levelConfig.player.fireCooldownMs) {
      return;
    }
    const projectile = this.projectiles.get(
      this.turret.x,
      this.turret.y,
      'projectile'
    );
    if (!projectile) {
      return;
    }
    projectile.setActive(true).setVisible(true);
    this.physics.velocityFromRotation(
      this.turret.rotation,
      this.levelConfig.player.projectileSpeed,
      projectile.body.velocity
    );
    projectile.setRotation(this.turret.rotation);
    this.lastShotAt = now;
    this.shotsFired += 1;
    this.emitState();
  }

  private updateEnemies() {
    for (const child of this.enemies.children) {
      const enemy = child as Phaser.Physics.Arcade.Sprite;
      const distance = Phaser.Math.Distance.Between(
        enemy.x,
        enemy.y,
        this.player.x,
        this.player.y
      );
      const detectionRange = enemy.getData('detectionRange') as number;
      if (distance <= detectionRange) {
        this.physics.moveToObject(
          enemy,
          this.player,
          enemy.getData('speed') as number
        );
      } else {
        enemy.setVelocity(0, 0);
      }
      const body = enemy.body as Phaser.Physics.Arcade.Body;
      enemy.setData({
        impactVelocityX: body.velocity.x,
        impactVelocityY: body.velocity.y,
      });
      this.drawEnemyHealth(enemy);
    }
  }

  private handleProjectileHit(
    projectile: Phaser.Physics.Arcade.Sprite,
    enemy: Phaser.Physics.Arcade.Sprite
  ) {
    projectile.destroy();
    const damage = calculateArmoredDamage(
      this.levelConfig.player.projectileDamage,
      enemy.getData('armorReduction') as number
    );
    const health = healthAfterDamage(enemy.getData('health') as number, damage);
    enemy.setData('health', health);
    this.showDamage(enemy.x, enemy.y, damage);

    if (health === 0) {
      this.destroyEnemy(enemy);
    } else {
      enemy.setTint(0xffffff);
      this.time.delayedCall(80, () => {
        if (enemy.active) enemy.clearTint();
      });
      this.drawEnemyHealth(enemy);
    }
    this.emitState();
  }

  private handleRam(enemy: Phaser.Physics.Arcade.Sprite) {
    const enemyId = enemy.getData('id') as string;
    const now = this.time.now;
    if (!isRamDamageReady(this.lastRamAt.get(enemyId), now)) return;

    const damage = calculateRamDamage(
      {
        armorReduction: this.levelConfig.player.armorReduction,
        mass: this.levelConfig.player.mass,
        velocityX: this.player.getData('impactVelocityX') as number,
        velocityY: this.player.getData('impactVelocityY') as number,
        x: this.player.x,
        y: this.player.y,
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
    if (damage.damageToFirst === 0 && damage.damageToSecond === 0) return;

    this.lastRamAt.set(enemyId, now);
    this.playerHealth = healthAfterDamage(
      this.playerHealth,
      damage.damageToFirst
    );
    const enemyHealth = healthAfterDamage(
      enemy.getData('health') as number,
      damage.damageToSecond
    );
    enemy.setData('health', enemyHealth);
    this.showDamage(this.player.x, this.player.y, damage.damageToFirst);
    this.showDamage(enemy.x, enemy.y, damage.damageToSecond);
    if (enemyHealth === 0) this.destroyEnemy(enemy);
    if (this.playerHealth === 0) this.disablePlayer();
    this.emitState();
  }

  private drawEnemyHealth(enemy: Phaser.Physics.Arcade.Sprite) {
    const bar = enemy.getData('healthBar') as Phaser.GameObjects.Graphics;
    const health = enemy.getData('health') as number;
    const maxHealth = enemy.getData('maxHealth') as number;
    const ratio = Math.max(0, health / maxHealth);
    bar.clear();
    bar.fillStyle(0x111911, 0.9).fillRect(enemy.x - 20, enemy.y - 28, 40, 5);
    bar
      .fillStyle(ratio > 0.35 ? 0x7eb668 : 0xdb725e, 1)
      .fillRect(enemy.x - 19, enemy.y - 27, 38 * ratio, 3);
  }

  private destroyEnemy(enemy: Phaser.Physics.Arcade.Sprite) {
    const bar = enemy.getData('healthBar') as Phaser.GameObjects.Graphics;
    bar.destroy();
    enemy.destroy();
  }

  private disablePlayer() {
    this.playerDestroyed = true;
    this.player.setVelocity(0, 0).setTint(0xb95b4b);
    this.turret.setTint(0xb95b4b);
  }

  private showDamage(x: number, y: number, damage: number) {
    if (damage <= 0) return;
    const label = this.add
      .text(x, y - 24, `-${damage}`, {
        color: '#ffd7cf',
        fontFamily: 'sans-serif',
        fontSize: '16px',
        fontStyle: 'bold',
      })
      .setDepth(5)
      .setOrigin(0.5);
    this.tweens.add({
      targets: label,
      y: label.y - 24,
      alpha: 0,
      duration: 500,
      onComplete: () => label.destroy(),
    });
  }

  private emitState() {
    this.onState({
      enemiesRemaining:
        this.enemies?.countActive(true) ?? this.levelConfig.enemies.length,
      shotsFired: this.shotsFired,
      playerHealth: this.playerHealth,
      playerMaxHealth: this.levelConfig.player.maxHealth,
      playerDestroyed: this.playerDestroyed,
    });
  }

  private createTextures() {
    const graphics = this.add.graphics();
    graphics.fillStyle(0x5d7d46).fillRoundedRect(0, 0, 52, 34, 8);
    graphics.generateTexture('tank-body', 52, 34);
    graphics.clear().fillStyle(0xe8c65a).fillRoundedRect(0, 0, 42, 10, 5);
    graphics.generateTexture('tank-turret', 42, 10);
    graphics.clear().fillStyle(0xd86a55).fillCircle(16, 16, 16);
    graphics.generateTexture('training-robot', 32, 32);
    graphics.clear().fillStyle(0xeadfbd).fillRect(0, 0, 12, 4);
    graphics.generateTexture('projectile', 12, 4);
    graphics.clear().fillStyle(0x74806b).fillRect(0, 0, 32, 32);
    graphics.generateTexture('obstacle', 32, 32);
    graphics.destroy();
  }
}
