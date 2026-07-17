import Phaser from 'phaser';

import type { GameInputController } from '../input/GameInputController.js';
import {
  createTrainingTextures,
  destroyEnemyVisual,
  drawEnemyHealth,
} from '../presentation/training-visuals.js';
import { resolveScenePalette } from '../presentation/map-visual-definition.js';
import {
  applyTankDepth,
  drawObstacleVisual,
  drawTrainingGround,
} from '../presentation/training-ground-visuals.js';
import {
  ENEMY_BODY_SIZES,
  PLAYER_BODY_SIZE,
  resolveEnemyTankVisual,
  resolvePlayerTankVisual,
} from '../presentation/tank-visual-definition.js';
import {
  configureTurretOrigin,
  createTankVisualTextures,
  enemyBodyTexture,
  enemyTurretTexture,
  lockTankBody,
  PLAYER_BODY_TEXTURE,
  PLAYER_TURRET_TEXTURE,
} from '../presentation/tank-visuals.js';
import { logCombatEvent } from '../systems/combat-log.js';
import {
  alertEnemiesAlongProjectilePath,
  alertEnemiesNearPlayerProjectiles,
  alertEnemySquad,
  createEnemyAwarenessData,
  projectileSourcePosition,
  resolveEnemyAwarenessDecision,
} from '../systems/enemy-awareness-scene.js';
import { shouldContinueSearch } from '../systems/enemy-ai.js';
import { fireEnemyProjectile } from '../systems/enemy-fire.js';
import { applyProjectileImpact } from '../systems/projectile-combat.js';
import { applyRamImpact } from '../systems/ram-combat.js';
import { calculateTankMotion } from '../systems/tank-motion.js';
import {
  activeWaveEnemyIds,
  applyMissionObjectiveEvent,
  createMissionObjectiveState,
  objectiveRuntimeSummary,
  type MissionObjectiveEvent,
  type MissionObjectiveState,
} from '../systems/mission-objectives.js';
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
  private objectiveState: MissionObjectiveState;

  constructor(
    private readonly levelConfig: RuntimeLevelConfig,
    private readonly onState: (state: RuntimeState) => void,
    private readonly gameInput: GameInputController
  ) {
    super('training');
    this.playerHealth = levelConfig.player.maxHealth;
    this.objectiveState = createMissionObjectiveState(levelConfig.objectiveSet);
  }

  create() {
    createTrainingTextures(this);
    createTankVisualTextures(this, this.levelConfig);
    this.physics.world.setBounds(
      0,
      0,
      this.levelConfig.width,
      this.levelConfig.height
    );
    const palette = resolveScenePalette(
      this.levelConfig.theme,
      this.levelConfig.visualResources
    );
    this.cameras.main.setBackgroundColor(palette.floor.base);
    drawTrainingGround(
      this,
      this.levelConfig.width,
      this.levelConfig.height,
      this.levelConfig.mapStyle,
      palette
    );

    const obstacles = this.physics.add.staticGroup();
    for (const obstacle of this.levelConfig.obstacles) {
      drawObstacleVisual(this, obstacle, palette);
      const sprite = obstacles.create(obstacle.x, obstacle.y, 'obstacle');
      sprite
        .setDisplaySize(obstacle.width, obstacle.height)
        .setAlpha(0)
        .refreshBody();
    }

    this.player = this.physics.add.sprite(
      this.levelConfig.playerSpawn.x,
      this.levelConfig.playerSpawn.y,
      PLAYER_BODY_TEXTURE
    );
    this.player
      .setCollideWorldBounds(true)
      .setDrag(600, 600)
      .setMaxVelocity(220);
    lockTankBody(this.player, PLAYER_BODY_SIZE);
    this.player.body?.setMass(this.levelConfig.player.mass);
    this.turret = this.add
      .image(this.player.x, this.player.y, PLAYER_TURRET_TEXTURE)
      .setDepth(2);
    configureTurretOrigin(
      this.turret,
      resolvePlayerTankVisual(
        this.levelConfig.player.visualCode,
        this.levelConfig.visualResources
      )
    );
    applyTankDepth(this.player, this.turret);

    this.enemies = this.physics.add.group();
    for (const enemy of this.levelConfig.enemies) {
      const sprite = this.enemies.create(
        enemy.x,
        enemy.y,
        enemyBodyTexture(enemy.role)
      );
      const turret = this.add
        .image(enemy.x, enemy.y, enemyTurretTexture(enemy.role))
        .setDepth(2);
      configureTurretOrigin(
        turret,
        resolveEnemyTankVisual(enemy.role, this.levelConfig.visualResources)
      );
      sprite.setData({
        id: enemy.id,
        elite: enemy.elite,
        spawnX: enemy.x,
        spawnY: enemy.y,
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
        ...createEnemyAwarenessData(enemy),
        impactVelocityX: 0,
        impactVelocityY: 0,
        healthBar: this.add.graphics().setDepth(3),
      });
      sprite.setCollideWorldBounds(true);
      lockTankBody(sprite, ENEMY_BODY_SIZES[enemy.role]);
      sprite.body?.setMass(enemy.mass);
      applyTankDepth(
        sprite,
        turret,
        sprite.getData('healthBar') as Phaser.GameObjects.Graphics
      );
      if (enemy.elite) {
        sprite.setTint(0xf2c14e);
        turret.setTint(0xf2c14e).setScale(1.12);
      }
    }

    this.syncWaveActivation();

    this.projectiles = this.physics.add.group({ maxSize: 24 });
    this.enemyProjectiles = this.physics.add.group({ maxSize: 48 });
    this.physics.add.collider(this.player, obstacles);
    this.physics.add.collider(this.enemies, obstacles);
    this.physics.add.collider(this.enemies, this.enemies);
    this.physics.add.collider(this.player, this.enemies, (_player, enemy) =>
      this.handleRam(enemy as Phaser.Physics.Arcade.Sprite)
    );
    this.physics.add.collider(this.projectiles, obstacles, (projectile) => {
      const playerProjectile = projectile as Phaser.Physics.Arcade.Sprite;
      alertEnemiesAlongProjectilePath(
        playerProjectile,
        this.enemies,
        this.time.now
      );
      playerProjectile.destroy();
    });
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
    this.createObjectiveZones();
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
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.updatePointerAim(pointer);
      this.gameInput.setCommand('fire', true, 'pointer');
    });
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) =>
      this.updatePointerAim(pointer)
    );
    this.input.on('pointerup', () =>
      this.gameInput.setCommand('fire', false, 'pointer')
    );
    this.input.on('pointerupoutside', () =>
      this.gameInput.setCommand('fire', false, 'pointer')
    );
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
      this.gameInput.resetAll()
    );
    logCombatEvent('scene_started', {
      enemyCount: this.levelConfig.enemies.length,
      mapStyle: this.levelConfig.mapStyle,
    });
    this.emitState();
  }

  update(time: number, delta: number) {
    if (this.playerDestroyed) return;

    this.gameInput.setCommand(
      'move-forward',
      this.controls.up.isDown,
      'keyboard'
    );
    this.gameInput.setCommand(
      'move-backward',
      this.controls.down.isDown,
      'keyboard'
    );
    this.gameInput.setCommand(
      'turn-left',
      this.controls.left.isDown,
      'keyboard'
    );
    this.gameInput.setCommand(
      'turn-right',
      this.controls.right.isDown,
      'keyboard'
    );
    this.gameInput.setCommand('fire', this.controls.fire.isDown, 'keyboard');
    const input = this.gameInput.snapshot();

    const motion = calculateTankMotion(
      this.player.rotation,
      this.levelConfig.player.speed,
      this.levelConfig.player.turnSpeed,
      {
        forward: input.forward,
        backward: input.backward,
        left: input.left,
        right: input.right,
      }
    );
    this.player.setVelocity(motion.velocityX, motion.velocityY);
    this.player.setData({
      impactVelocityX: motion.velocityX,
      impactVelocityY: motion.velocityY,
    });
    this.player.rotation += motion.angularVelocity * (delta / 1000);

    this.turret.setPosition(this.player.x, this.player.y);
    const touchAim = Number(input.aimRight) - Number(input.aimLeft);
    if (touchAim !== 0) {
      this.turret.rotation += touchAim * 2.4 * (delta / 1000);
    } else if (input.aimTarget) {
      this.turret.rotation = Phaser.Math.Angle.Between(
        this.turret.x,
        this.turret.y,
        input.aimTarget.x,
        input.aimTarget.y
      );
    }
    applyTankDepth(this.player, this.turret);

    const fireRequested = this.gameInput.consumeFireRequest();
    if (
      (input.fire || fireRequested) &&
      time - this.lastShotAt >= this.levelConfig.player.fireCooldownMs
    ) {
      this.fire();
    }
    alertEnemiesNearPlayerProjectiles(this.projectiles, this.enemies, time);
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
      sourceX: this.turret.x,
      sourceY: this.turret.y,
      previousX: this.turret.x,
      previousY: this.turret.y,
      alertedEnemyIds: [],
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

  private updatePointerAim(pointer: Phaser.Input.Pointer) {
    const worldPoint = pointer.positionToCamera(
      this.cameras.main
    ) as Phaser.Math.Vector2;
    this.gameInput.setAimTarget(worldPoint.x, worldPoint.y);
  }

  private updateEnemies(time: number) {
    for (const child of this.enemies.children) {
      const enemy = child as Phaser.Physics.Arcade.Sprite;
      if (!enemy.active) continue;
      const turret = enemy.getData('turret') as Phaser.GameObjects.Image;
      const distance = Phaser.Math.Distance.Between(
        enemy.x,
        enemy.y,
        this.player.x,
        this.player.y
      );
      const { action, targetPosition, homePosition } =
        resolveEnemyAwarenessDecision(
          enemy,
          time,
          { x: this.player.x, y: this.player.y },
          this.levelConfig.player.visibilityMultiplier
        );
      const angle = Phaser.Math.Angle.Between(
        enemy.x,
        enemy.y,
        targetPosition.x,
        targetPosition.y
      );

      if (action === 'chase') {
        this.physics.moveToObject(
          enemy,
          this.player,
          enemy.getData('speed') as number
        );
        enemy.rotation = angle;
      } else if (action === 'search') {
        const distanceToLastKnownPosition = Phaser.Math.Distance.Between(
          enemy.x,
          enemy.y,
          targetPosition.x,
          targetPosition.y
        );
        if (shouldContinueSearch(distanceToLastKnownPosition)) {
          this.physics.moveTo(
            enemy,
            targetPosition.x,
            targetPosition.y,
            enemy.getData('speed') as number
          );
          enemy.rotation = angle;
        } else {
          enemy.setVelocity(0, 0);
        }
      } else if (
        shouldContinueSearch(
          Phaser.Math.Distance.Between(
            enemy.x,
            enemy.y,
            homePosition.x,
            homePosition.y
          )
        )
      ) {
        this.physics.moveTo(
          enemy,
          homePosition.x,
          homePosition.y,
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
      applyTankDepth(enemy, turret, healthBar);
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
    const sourcePosition = projectileSourcePosition(projectile, this.player);
    const resolution = applyProjectileImpact(
      this,
      projectile,
      enemy,
      enemy.getData(
        'armorProfile'
      ) as RuntimeLevelConfig['player']['armorProfile'],
      enemy.getData('health') as number,
      'player',
      enemyId,
      this.levelConfig.locale
    );
    if (!resolution) return;
    alertEnemySquad(
      this.enemies,
      enemy,
      this.time.now,
      sourcePosition,
      'direct_hit'
    );
    enemy.setData('health', resolution.health);

    if (resolution.health === 0) {
      logCombatEvent('enemy_destroyed', {
        enemyId,
        source: 'projectile',
      });
      destroyEnemyVisual(enemy);
      this.applyObjectiveEvent({
        type: 'enemy-defeated',
        enemyId,
      });
      this.syncWaveActivation();
    } else {
      enemy.setTint(0xffffff);
      this.time.delayedCall(80, () => {
        if (enemy.active) {
          if (enemy.getData('elite') as boolean) enemy.setTint(0xf2c14e);
          else enemy.clearTint();
        }
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
      'player',
      this.levelConfig.locale
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
    if (resolution.enemyDestroyed) {
      this.applyObjectiveEvent({ type: 'enemy-defeated', enemyId });
      this.syncWaveActivation();
    }
    if (this.playerHealth === 0) this.disablePlayer();
    this.emitState();
  }

  private disablePlayer() {
    if (this.playerDestroyed) return;
    this.playerDestroyed = true;
    this.gameInput.resetAll();
    this.player.setVelocity(0, 0).setTint(0xb95b4b);
    this.turret.setTint(0xb95b4b);
    logCombatEvent('player_destroyed', { playerHealth: this.playerHealth });
  }

  private emitState() {
    const objective = objectiveRuntimeSummary(this.objectiveState);
    this.onState({
      enemiesRemaining:
        this.levelConfig.enemies.length -
        this.objectiveState.defeatedEnemyIds.length,
      shotsFired: this.shotsFired,
      playerHealth: this.playerHealth,
      playerMaxHealth: this.levelConfig.player.maxHealth,
      playerDestroyed: this.playerDestroyed,
      ...objective,
    });
  }

  private createObjectiveZones() {
    for (const objective of this.levelConfig.objectiveSet.objectives) {
      const points =
        objective.type === 'supply-run'
          ? objective.points.map((point) => ({
              ...point,
              event: {
                type: 'supply-collected' as const,
                pointId: point.id,
              },
              color: 0xe8c65a,
            }))
          : objective.type === 'route-choice'
            ? objective.checkpoints.map((point) => ({
                ...point,
                event: {
                  type: 'checkpoint-reached' as const,
                  checkpointId: point.id,
                },
                color: 0x63c7da,
              }))
            : [];
      for (const point of points) {
        const marker = this.add
          .circle(point.x, point.y, 18, point.color, 0.28)
          .setStrokeStyle(3, point.color, 0.9)
          .setDepth(1);
        const zone = this.add.zone(point.x, point.y, 48, 48);
        this.physics.add.existing(zone, true);
        this.physics.add.overlap(this.player, zone, () => {
          const accepted = this.applyObjectiveEvent(point.event);
          if (!accepted) return;
          marker.destroy();
          zone.destroy();
        });
      }
    }
  }

  private applyObjectiveEvent(event: MissionObjectiveEvent) {
    const before = this.objectiveState.objectives
      .map((objective) => objective.current)
      .join(':');
    this.objectiveState = applyMissionObjectiveEvent(
      this.levelConfig.objectiveSet,
      this.objectiveState,
      event
    );
    const after = this.objectiveState.objectives
      .map((objective) => objective.current)
      .join(':');
    if (before === after) return false;
    logCombatEvent('objective_progressed', {
      eventType: event.type,
      objectiveComplete: String(this.objectiveState.complete),
    });
    this.emitState();
    return true;
  }

  private syncWaveActivation() {
    if (!this.enemies) return;
    const activeIds = activeWaveEnemyIds(
      this.levelConfig.objectiveSet,
      this.objectiveState
    );
    if (activeIds === null) return;
    const waveEnemyIds = new Set(
      this.levelConfig.objectiveSet.objectives.flatMap((objective) =>
        objective.type === 'defend-waves'
          ? objective.waves.flatMap((wave) => wave.enemyIds)
          : []
      )
    );
    const activeWaveIds = new Set(activeIds);
    for (const child of this.enemies.children) {
      const enemy = child as Phaser.Physics.Arcade.Sprite;
      const enemyId = enemy.getData('id') as string;
      if (this.objectiveState.defeatedEnemyIds.includes(enemyId)) continue;
      const shouldBeActive =
        !waveEnemyIds.has(enemyId) || activeWaveIds.has(enemyId);
      const turret = enemy.getData('turret') as Phaser.GameObjects.Image;
      const healthBar = enemy.getData(
        'healthBar'
      ) as Phaser.GameObjects.Graphics;
      if (shouldBeActive && !enemy.active) {
        enemy.enableBody(
          false,
          enemy.getData('spawnX') as number,
          enemy.getData('spawnY') as number,
          true,
          true
        );
        turret.setVisible(true);
      } else if (!shouldBeActive && enemy.active) {
        enemy.disableBody(true, true);
        turret.setVisible(false);
        healthBar.setVisible(false);
      }
    }
  }
}
