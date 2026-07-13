import Phaser from 'phaser';

import { calculateTankMotion } from '../systems/tank-motion.js';
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

  constructor(
    private readonly levelConfig: RuntimeLevelConfig,
    private readonly onState: (state: RuntimeState) => void
  ) {
    super('training');
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
    this.turret = this.add
      .image(this.player.x, this.player.y, 'tank-turret')
      .setDepth(2);

    this.enemies = this.physics.add.group();
    for (const enemy of this.levelConfig.enemies) {
      const sprite = this.enemies.create(enemy.x, enemy.y, 'training-robot');
      sprite.setData({
        speed: enemy.speed,
        detectionRange: enemy.detectionRange,
      });
      sprite.setCollideWorldBounds(true);
    }

    this.projectiles = this.physics.add.group({ maxSize: 24 });
    this.physics.add.collider(this.player, obstacles);
    this.physics.add.collider(this.enemies, obstacles);
    this.physics.add.collider(this.projectiles, obstacles, (projectile) =>
      projectile.destroy()
    );
    this.physics.add.overlap(
      this.projectiles,
      this.enemies,
      (projectile, enemy) => {
        projectile.destroy();
        enemy.destroy();
        this.emitState();
      }
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
    }
  }

  private emitState() {
    this.onState({
      enemiesRemaining:
        this.enemies?.countActive(true) ?? this.levelConfig.enemies.length,
      shotsFired: this.shotsFired,
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
