import Phaser from 'phaser';

import {
  createTrainingTextures,
  destroyEnemyVisual,
  drawTrainingMap,
  drawEnemyHealth,
} from '../presentation/training-visuals.js';
import { logCombatEvent } from '../systems/combat-log.js';
import {
  effectiveEnemyDetectionRange,
  selectEnemyAction,
} from '../systems/enemy-ai.js';
import { fireEnemyProjectile } from '../systems/enemy-fire.js';
import { applyProjectileImpact } from '../systems/projectile-combat.js';
import { applyRamImpact } from '../systems/ram-combat.js';
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
  private enemyProjectiles!: Phaser.Physics.Arcade.Group;
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
    createTrainingTextures(this);
    this.physics.world.setBounds(
      0,
      0,
      this.levelConfig.width,
      this.levelConfig.height
    );
    this.cameras.main.setBackgroundColor('#263826');
    drawTrainingMap(
      this,
      this.levelConfig.width,
      this.levelConfig.height,
      this.levelConfig.mapStyle
    );

    const obstacles = this.physics.add.staticGroup();
    for (const obstacle of this.levelConfig.obstacles) {
      const sprite = obstacles.create(obstacle.x, obstacle.y, 'obstacle');
      sprite.setDisplaySize(obstacle.width, obstacle.height).refreshBody();
    }

    this.player = this.physics.add.sprite(
      this.levelConfig.playerSpawn.x,
      this.levelConfig.playerSpawn.y,
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
      const sprite = this.enemies.create(
        enemy.x,
        enemy.y,
        `enemy-${enemy.role}-body`
      );
      const turret = this.add
        .image(enemy.x, enemy.y, `enemy-${enemy.role}-turret`)
        .setDepth(2);
      sprite.setData({
        id: enemy.id,
        turret,
        health: enemy.maxHealth,
        maxHealth: enemy.maxHealth,
        armorReduction: enemy.armorReduction,
        armorProfile: enemy.armorProfile,
        mass: enemy.mass,
        speed: enemy.speed,
        detectionRange: enemy.detectionRange,
        attackRange: enemy.attackRange,
        projectileDamage: enemy.projectileDamage,
        projectilePenetration: enemy.projectilePenetration,
        projectileSpeed: enemy.projectileSpeed,
        fireCooldownMs: enemy.fireCooldownMs,
        lastShotAt: -enemy.fireCooldownMs,
        impactVelocityX: 0,
        impactVelocityY: 0,
        healthBar: this.add.graphics().setDepth(3),
      });
      sprite.setCollideWorldBounds(true);
      sprite.body?.setMass(enemy.mass);
    }

    this.projectiles = this.physics.add.group({ maxSize: 24 });
    this.enemyProjectiles = this.physics.add.group({ maxSize: 48 });
    this.physics.add.collider(this.player, obstacles);
    this.physics.add.collider(this.enemies, obstacles);
    this.physics.add.collider(this.enemies, this.enemies);
    this.physics.add.collider(this.player, this.enemies, (_player, enemy) =>
      this.handleRam(enemy as Phaser.Physics.Arcade.Sprite)
    );
    this.physics.add.collider(this.projectiles, obstacles, (projectile) =>
      projectile.destroy()
    );
    this.physics.add.collider(this.enemyProjectiles, obstacles, (projectile) =>
      projectile.destroy()
    );
    this.physics.add.overlap(
      this.player,
      this.enemyProjectiles,
      (_player, projectile) =>
        this.handleEnemyProjectileHit(
          projectile as Phaser.Physics.Arcade.Sprite
        )
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
    logCombatEvent('scene_started', {
      enemyCount: this.levelConfig.enemies.length,
      mapStyle: this.levelConfig.mapStyle,
    });
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
    this.updateEnemies(time);
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
    projectile.setActive(true).setVisible(true).setData({
      damage: this.levelConfig.player.projectileDamage,
      penetration: this.levelConfig.player.projectilePenetration,
    });
    this.physics.velocityFromRotation(
      this.turret.rotation,
      this.levelConfig.player.projectileSpeed,
      projectile.body.velocity
    );
    projectile.setRotation(this.turret.rotation);
    this.time.delayedCall(1800, () => {
      if (projectile.active) projectile.destroy();
    });
    this.lastShotAt = now;
    this.shotsFired += 1;
    this.emitState();
  }

  private updateEnemies(time: number) {
    for (const child of this.enemies.children) {
      const enemy = child as Phaser.Physics.Arcade.Sprite;
      const turret = enemy.getData('turret') as Phaser.GameObjects.Image;
      const distance = Phaser.Math.Distance.Between(
        enemy.x,
        enemy.y,
        this.player.x,
        this.player.y
      );
      const detectionRange = effectiveEnemyDetectionRange(
        enemy.getData('detectionRange') as number,
        this.levelConfig.player.visibilityMultiplier
      );
      const action = selectEnemyAction(
        distance,
        detectionRange,
        enemy.getData('attackRange') as number
      );
      const angle = Phaser.Math.Angle.Between(
        enemy.x,
        enemy.y,
        this.player.x,
        this.player.y
      );

      if (action === 'chase') {
        this.physics.moveToObject(
          enemy,
          this.player,
          enemy.getData('speed') as number
        );
        enemy.rotation = angle;
      } else {
        enemy.setVelocity(0, 0);
      }
      turret.setPosition(enemy.x, enemy.y);
      turret.rotation = action === 'idle' ? enemy.rotation : angle;
      if (action === 'fire') {
        fireEnemyProjectile(this, this.enemyProjectiles, enemy, turret, time);
      }

      const revealed = distance <= this.levelConfig.player.detectionRange;
      enemy.setAlpha(revealed ? 1 : 0.24);
      turret.setAlpha(revealed ? 1 : 0.24);
      const healthBar = enemy.getData(
        'healthBar'
      ) as Phaser.GameObjects.Graphics;
      healthBar.setVisible(revealed);
      const body = enemy.body as Phaser.Physics.Arcade.Body;
      enemy.setData({
        impactVelocityX: body.velocity.x,
        impactVelocityY: body.velocity.y,
      });
      drawEnemyHealth(enemy);
    }
  }

  private handleProjectileHit(
    projectile: Phaser.Physics.Arcade.Sprite,
    enemy: Phaser.Physics.Arcade.Sprite
  ) {
    const enemyId = enemy.getData('id') as string;
    const resolution = applyProjectileImpact(
      this,
      projectile,
      enemy,
      enemy.getData(
        'armorProfile'
      ) as RuntimeLevelConfig['player']['armorProfile'],
      enemy.getData('health') as number,
      'player',
      enemyId
    );
    if (!resolution) return;
    enemy.setData('health', resolution.health);

    if (resolution.health === 0) {
      logCombatEvent('enemy_destroyed', {
        enemyId,
        source: 'projectile',
      });
      destroyEnemyVisual(enemy);
    } else {
      enemy.setTint(0xffffff);
      this.time.delayedCall(80, () => {
        if (enemy.active) enemy.clearTint();
      });
      drawEnemyHealth(enemy);
    }
    this.emitState();
  }

  private handleEnemyProjectileHit(projectile: Phaser.Physics.Arcade.Sprite) {
    if (this.playerDestroyed) return;
    const resolution = applyProjectileImpact(
      this,
      projectile,
      this.player,
      this.levelConfig.player.armorProfile,
      this.playerHealth,
      'enemy',
      'player'
    );
    if (!resolution) return;
    this.playerHealth = resolution.health;
    this.player.setTint(0xffffff);
    this.time.delayedCall(80, () => {
      if (!this.playerDestroyed) this.player.clearTint();
    });
    if (this.playerHealth === 0) this.disablePlayer();
    this.emitState();
  }

  private handleRam(enemy: Phaser.Physics.Arcade.Sprite) {
    const now = this.time.now;
    const enemyId = enemy.getData('id') as string;
    const resolution = applyRamImpact(
      this,
      this.player,
      enemy,
      this.levelConfig.player,
      this.playerHealth,
      this.lastRamAt.get(enemyId),
      now
    );
    if (!resolution) return;
    this.lastRamAt.set(resolution.enemyId, now);
    this.playerHealth = resolution.playerHealth;
    if (this.playerHealth === 0) this.disablePlayer();
    this.emitState();
  }

  private disablePlayer() {
    if (this.playerDestroyed) return;
    this.playerDestroyed = true;
    this.player.setVelocity(0, 0).setTint(0xb95b4b);
    this.turret.setTint(0xb95b4b);
    logCombatEvent('player_destroyed', { playerHealth: this.playerHealth });
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
}
