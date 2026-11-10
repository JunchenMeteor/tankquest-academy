/**
 * Three.js battle view.
 * Owns the WebGL scene, tank meshes and camera; game rules stay in the existing
 * session runtime, and the pure geometry lives in battle-scene-model.
 */
import {
  AmbientLight,
  MeshBasicMaterial,
  BoxGeometry,
  Color,
  DirectionalLight,
  DoubleSide,
  Fog,
  GridHelper,
  Group,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  PCFSoftShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  Raycaster,
  RingGeometry,
  Scene,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';

import {
  buildSceneLayout,
  cameraPose,
  groundHeight,
  resolveCameraPose,
  resolveObstacles,
  stepTank,
  type CameraMode,
  type SceneLayout,
} from './battle-scene-model.js';
import { driveCommand, normaliseAngle } from './battle-input.js';
import {
  resolveScenePalette,
  type ScenePalette,
} from '../presentation/map-visual-definition.js';
import {
  aimAlignmentError,
  aimPitch,
  aimYaw,
  clampGunPitch,
  FIRE_AIM_TOLERANCE,
  projectGunSight,
  resolveAimPoint,
  rotateTowards,
  scatterAimPoint,
  stepGunPitch,
} from './battle-aim.js';
import { buildTankModel } from './tank-model.js';
import { createTankLabel } from './battle-tank-label.js';
import { loadTankRig, paintTankRig } from './tank-asset.js';
import { advanceRunningGear, type TankRig } from './tank-rig.js';
import {
  advanceEnemy,
  enemyGoal,
  enemyReloadMs,
  groupSpread,
  openingDelayMs,
} from './battle-enemy-ai.js';
import { aimEnemyWeapon, type EnemyAimState } from './battle-enemy-aim.js';
import { BattleEffects } from './battle-effects.js';
import { BattleHitFeedback } from './battle-hit-feedback.js';
import { advanceReload } from './battle-combat.js';
import { createMeshHitTest } from './battle-mesh-collision.js';
import { applyRamImpacts, calculateRamImpacts } from './battle-ram.js';
import { FixedStepDriver } from './battle-fixed-step.js';
import { applyAnswerCombo, emptyCombo } from './battle-combo.js';
import { planWaves } from './battle-waves.js';
import {
  createFrameSampler,
  downgrade,
  qualitySettings,
  shouldDowngrade,
  type QualityTier,
} from './quality-tier.js';
import {
  MAX_AMMO,
  SHELL_RANGE,
  advanceEnemyFire,
  advanceEnemyShells,
  advanceShells,
  applyWrongAnswer,
  canFire,
  createCombatState,
  loadAmmo,
  spawnEnemyShell,
  spawnShell,
  tickCooldown,
} from './battle-combat.js';
import { logCombatEvent } from '../systems/combat-log.js';
import type { GameInputController } from '../input/GameInputController.js';
import type { RuntimeState } from '../runtime/types.js';
import type { RuntimeLevelConfig } from '../runtime/types.js';

export interface Battle3DHandle {
  setMode(mode: CameraMode): void;
  getMode(): CameraMode;
  /** Applies a graded answer: rewarded ammo on a hit, a reload penalty otherwise. */
  applyAnswer(correct: boolean, reward: number): void;
  dispose(): void;
}

function buildGround(layout: SceneLayout, palette: ScenePalette): Group {
  const ground = new Group();
  /* The ground matches the playable bounds, so the edge you see is the edge you hit. */
  const visualWidth = layout.ground.width;
  const visualDepth = layout.ground.depth;
  const geometry = new PlaneGeometry(visualWidth, visualDepth, 64, 64);
  const attribute = geometry.getAttribute('position');
  for (let index = 0; index < attribute.count; index += 1) {
    const x = attribute.getX(index);
    const y = attribute.getY(index);
    attribute.setZ(index, groundHeight(x, -y));
  }
  geometry.computeVertexNormals();

  const floor = new Mesh(
    geometry,
    new MeshStandardMaterial({ color: palette.floor.base, roughness: 0.95 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  ground.add(floor);

  const grid = new GridHelper(
    visualWidth,
    90,
    palette.floor.accent,
    palette.floor.grid
  );
  grid.material.opacity = 0.22;
  grid.material.transparent = true;
  grid.position.y = 0.04;
  ground.add(grid);

  for (const block of layout.blocks) {
    const mesh = new Mesh(
      new BoxGeometry(block.size[0], block.size[1], block.size[2]),
      new MeshStandardMaterial({ color: palette.obstacle.top, roughness: 0.85 })
    );
    mesh.position.set(block.position.x, block.position.y, block.position.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    ground.add(mesh);
  }
  for (const enemy of layout.enemies) {
    const elevation = enemy.position.y;
    if (!enemy.passive || elevation <= 0.3) continue;
    const platform = new Mesh(
      new BoxGeometry(4.2, elevation, 6.4),
      new MeshStandardMaterial({
        color: palette.obstacle.side,
        roughness: 0.9,
      })
    );
    platform.position.set(enemy.position.x, elevation / 2, enemy.position.z);
    platform.castShadow = true;
    platform.receiveShadow = true;
    ground.add(platform);
  }
  return ground;
}

/** A low fence around the walkable field, so the ground edge never shows. */
function buildFence(layout: SceneLayout, palette: ScenePalette): Group {
  const group = new Group();
  const bounds = layout.ground;
  const halfWidth = bounds.width / 2 - 1;
  const halfDepth = bounds.depth / 2 - 1;
  const material = new MeshStandardMaterial({
    color: palette.boundary.side,
    roughness: 0.9,
    metalness: 0.1,
  });
  const height = 1.6;
  const thickness = 0.5;
  const sides: Array<[number, number, number, number]> = [
    [0, -halfDepth, bounds.width, thickness],
    [0, halfDepth, bounds.width, thickness],
    [-halfWidth, 0, thickness, bounds.depth],
    [halfWidth, 0, thickness, bounds.depth],
  ];
  for (const [x, z, width, depth] of sides) {
    const wall = new Mesh(new BoxGeometry(width, height, depth), material);
    wall.position.set(x, height / 2 - 0.2, z);
    wall.castShadow = true;
    wall.receiveShadow = true;
    group.add(wall);
  }
  return group;
}

export function createBattleView(
  host: HTMLElement,
  config: RuntimeLevelConfig,
  input?: GameInputController,
  onState?: (state: RuntimeState) => void,
  onAmmo?: (ammo: number, max: number) => void,
  initialQuality: QualityTier = 'high',
  onQualityChange?: (tier: QualityTier) => void,
  onPointerLock?: (locked: boolean) => void,
  onAimOffset?: (radians: number) => void,
  onReticle?: (x: number, y: number, width: number, height: number) => void,
  onPointerReticle?: (
    x: number,
    y: number,
    width: number,
    height: number,
    aligned: boolean
  ) => void,
  onCombo?: (streak: number, bonusAmmo: number) => void,
  playerName = 'Star Shield'
): Battle3DHandle {
  const layout = buildSceneLayout(config);
  const palette = resolveScenePalette(config.theme, config.visualResources);
  const scene = new Scene();
  scene.background = new Color(palette.floor.grid);
  scene.fog = new Fog(palette.floor.base, 60, 190);

  let quality: QualityTier = initialQuality;
  const renderer = new WebGLRenderer({
    antialias: qualitySettings[quality].antialias,
  });
  renderer.setPixelRatio(
    Math.min(globalThis.devicePixelRatio ?? 1, qualitySettings[quality].dprCap)
  );
  renderer.shadowMap.enabled = qualitySettings[quality].shadows;
  renderer.shadowMap.type = PCFSoftShadowMap;
  renderer.domElement.dataset.renderMode = '3d';
  host.appendChild(renderer.domElement);

  const key = new DirectionalLight(0xfff4d6, 4.2);
  key.position.set(-14, 18, 10);
  key.castShadow = qualitySettings[quality].shadows;
  key.shadow.mapSize.set(
    qualitySettings[quality].shadowMapSize,
    qualitySettings[quality].shadowMapSize
  );
  key.shadow.camera.left = -30;
  key.shadow.camera.right = 30;
  key.shadow.camera.top = 30;
  key.shadow.camera.bottom = -30;
  scene.add(key);
  scene.add(new HemisphereLight(0xcfe0ff, 0x5a4c36, 1.6));
  scene.add(new AmbientLight(0xffffff, 0.45));

  const ground = buildGround(layout, palette);
  scene.add(ground);
  /* A distant skirt keeps the horizon filled; the fence marks the real edge. */
  const skirt = new Mesh(
    new PlaneGeometry(600, 600),
    new MeshStandardMaterial({
      color: palette.floor.base,
      roughness: 1,
      metalness: 0,
    })
  );
  skirt.rotation.x = -Math.PI / 2;
  skirt.position.y = -0.02;
  skirt.receiveShadow = true;
  scene.add(skirt);
  scene.add(buildFence(layout, palette));

  let playerRig: TankRig = buildTankModel(layout.player, true);
  const playerLabel = createTankLabel(
    playerName,
    config.player.maxHealth,
    config.player.maxHealth,
    'player'
  );
  playerRig.root.add(playerLabel.sprite);
  scene.add(playerRig.root);
  const proceduralRigs = new Map<string, TankRig>();
  proceduralRigs.set('player', playerRig);
  let usingGlbTanks = false;
  let glbAsset: TankRig | null = null;
  const effects = new BattleEffects(scene);
  const hitFeedback = new BattleHitFeedback(scene);
  const gunRestPosition = playerRig.gun.position.clone();
  let recoil = 0;
  const enemySpeeds = new Map<string, number>();
  for (const enemy of config.enemies) {
    enemySpeeds.set(enemy.id, enemy.speed * 0.06);
  }
  /* Difficulty follows the group size: more tanks, sharper shooting. */
  const difficulty = Math.min(1, Math.max(0, (config.enemies.length - 1) / 3));
  const enemyRoots = new Map<string, Group>();
  const enemyRigs = new Map<string, TankRig>();
  const enemyAimStates = new Map<string, EnemyAimState>();
  const enemyLabels = new Map<string, ReturnType<typeof createTankLabel>>();
  const roleNames =
    config.locale === 'zh-CN'
      ? { scout: '侦察型', medium: '中型', heavy: '重型' }
      : { scout: 'Scout', medium: 'Medium', heavy: 'Heavy' };
  const meshHitTest = createMeshHitTest(enemyRoots);
  const spawnEnemy = (enemy: (typeof layout.enemies)[number]) => {
    const rig = glbAsset
      ? paintTankRig(glbAsset, enemy.color, enemy.secondaryColor)
      : buildTankModel(enemy, false);
    const maximumHealth = enemy.combat?.maxHealth ?? 100;
    const roleName = `${enemy.elite ? '★ ' : ''}${roleNames[enemy.role]}`;
    const label = createTankLabel(
      roleName,
      maximumHealth,
      maximumHealth,
      'enemy'
    );
    rig.root.add(label.sprite);
    enemyLabels.set(enemy.id, label);
    enemyRoots.set(enemy.id, rig.root);
    enemyRigs.set(enemy.id, rig);
    enemyAimStates.set(enemy.id, { turret: 0, pitch: 0.1 });
    scene.add(rig.root);
  };
  const waves = layout.enemies.every((enemy) => enemy.passive)
    ? [layout.enemies.map((_, index) => index)]
    : planWaves(layout.enemies.length, difficulty);
  const pendingWaves = waves.slice(1);
  for (const index of waves[0] ?? []) {
    const enemy = layout.enemies[index];
    if (enemy) spawnEnemy(enemy);
  }

  let combat = createCombatState(
    layout.enemies.length,
    1,
    config.player.maxHealth,
    layout.enemies
  );
  for (const [slot, enemy] of layout.enemies.entries()) {
    combat.enemyCooldowns[enemy.id] = openingDelayMs(slot, difficulty);
  }
  const totalEnemies = layout.enemies.length;
  let destroyedCount = 0;
  let combo = emptyCombo();
  const ramCooldowns = new Map<string, number>();
  let ramTimeMs = 0;

  const destroyEnemies = (ids: string[], source: 'ram' | 'shell') => {
    for (const id of ids) {
      const root = enemyRoots.get(id);
      if (root) {
        const impact = new Mesh(
          new RingGeometry(0.6, 1.4, 24),
          new MeshBasicMaterial({
            color: 0xffa24a,
            transparent: true,
            opacity: 0.85,
            side: DoubleSide,
          })
        );
        impact.rotation.x = -Math.PI / 2;
        impact.position.set(root.position.x, 0.35, root.position.z);
        effects.spawn(impact, 0.55, 4);
        const blast = new Mesh(
          new SphereGeometry(0.55, 10, 8),
          new MeshBasicMaterial({
            color: 0xffc06a,
            transparent: true,
            opacity: 0.85,
          })
        );
        blast.position.copy(root.position);
        blast.position.y += 1;
        effects.spawn(blast, 0.24, 1.8);
        scene.remove(root);
        enemyRoots.delete(id);
      }
      enemyRigs.delete(id);
      enemyAimStates.delete(id);
      enemyLabels.get(id)?.dispose();
      enemyLabels.delete(id);
      destroyedCount += 1;
      logCombatEvent('enemy_destroyed', { enemyId: id, source });
    }
    if (enemyRoots.size === 0 && pendingWaves.length > 0) {
      for (const index of pendingWaves.shift() ?? []) {
        const enemy = layout.enemies[index];
        if (enemy) spawnEnemy(enemy);
      }
      publish();
    }
  };

  const publish = () => {
    onState?.({
      enemiesRemaining: combat.enemiesRemaining,
      shotsFired: combat.shotsFired,
      enemiesDestroyed: destroyedCount,
      bestStreak: combo.best,
      playerHealth: combat.playerHealth,
      playerMaxHealth: combat.playerMaxHealth,
      playerDestroyed: combat.playerDestroyed,
      objectiveComplete: destroyedCount >= totalEnemies,
      objectiveType: 'eliminate',
      objectiveCurrent: destroyedCount,
      objectiveTarget: totalEnemies,
    });
  };
  publish();
  onAmmo?.(combat.ammo, MAX_AMMO);

  const camera = new PerspectiveCamera(60, 1, 0.1, 300);
  const traverseSpeed = config.player.turretTraverseSpeed;
  const elevationSpeed = config.player.gunElevationSpeed ?? 0.9;
  const dispersion = config.player.dispersionRadius;
  let rightHeld = false;
  const raycaster = new Raycaster();
  const aimPoint = new Vector3();
  let camYaw = layout.player.heading;
  let camPitch = 0.15;
  let gunPitch = camPitch;
  /* Pointer target in CSS pixels inside the canvas; the gun sight is separate. */
  const aim = { x: 0, y: 0, ready: false };
  const state = {
    mode: 'third' as CameraMode,
    heading: layout.player.heading,
    position: { ...layout.player.position },
    trackSpeed: 0,
    turnRate: 0,
    turret: 0,
  };
  const updateLabelVisibility = (
    label: ReturnType<typeof createTankLabel>,
    width: number,
    height: number
  ) => {
    const projected = label.sprite
      .getWorldPosition(new Vector3())
      .project(camera);
    const x = ((projected.x + 1) / 2) * width;
    const y = ((1 - projected.y) / 2) * height;
    label.sprite.visible = !aim.ready || Math.hypot(x - aim.x, y - aim.y) > 96;
  };

  const resize = () => {
    const width = host.clientWidth || 960;
    const height = host.clientHeight || 540;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  resize();
  globalThis.addEventListener('resize', resize);

  /** Re-applies the tier to an existing renderer, cheapest knobs first. */
  const applyQuality = (tier: QualityTier) => {
    const settings = qualitySettings[tier];
    renderer.setPixelRatio(
      Math.min(globalThis.devicePixelRatio ?? 1, settings.dprCap)
    );
    renderer.shadowMap.enabled = settings.shadows;
    key.castShadow = settings.shadows;
    if (key.shadow.mapSize.x !== settings.shadowMapSize) {
      key.shadow.map?.dispose();
      key.shadow.map = null;
      key.shadow.mapSize.set(settings.shadowMapSize, settings.shadowMapSize);
      key.shadow.needsUpdate = true;
    }
    if (scene.fog instanceof Fog) {
      scene.fog.far = settings.fogFar;
    }
    resize();
  };

  const canvas = renderer.domElement;
  const look = (movementX: number, movementY: number) => {
    camYaw -= movementX * 0.0016;
    camPitch = Math.max(-0.5, Math.min(0.8, camPitch - movementY * 0.0011));
  };

  /*
   * No pointer lock or virtual cursor: the pointer target follows the mouse,
   * while the second sight follows the real barrel until both are aligned.
   */
  canvas.classList.add('battle-canvas--locked');
  const updateAim = (clientX: number, clientY: number) => {
    const bounds = canvas.getBoundingClientRect();
    aim.x = Math.max(0, Math.min(bounds.width, clientX - bounds.left));
    aim.y = Math.max(0, Math.min(bounds.height, clientY - bounds.top));
    aim.ready = true;
  };

  canvas.addEventListener('pointermove', (event) => {
    /* Look around only while the right button is held, otherwise the view stays
       behind the hull so the world does not swing while aiming. */
    if (rightHeld) look(event.movementX, event.movementY);
    updateAim(event.clientX, event.clientY);
  });
  canvas.addEventListener('pointerdown', (event) => {
    if (event.button === 2) rightHeld = true;
    if (event.button === 0) {
      updateAim(event.clientX, event.clientY);
      input?.setCommand('fire', true, 'pointer');
    }
  });
  globalThis.addEventListener('pointerup', (event) => {
    if (event.button === 0) input?.setCommand('fire', false, 'pointer');
    if (event.button === 2) rightHeld = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  const observer =
    typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(() => resize());
  observer?.observe(host);

  const cameraBlocks = [
    ...layout.blocks,
    ...layout.enemies
      .filter((enemy) => enemy.passive && enemy.position.y > 0.3)
      .map((enemy) => ({
        position: {
          x: enemy.position.x,
          y: enemy.position.y / 2,
          z: enemy.position.z,
        },
        size: [4.2, enemy.position.y, 6.4] as [number, number, number],
      })),
  ];
  const applyCamera = () => {
    const idealPose = cameraPose(
      state.mode,
      { ...state, heading: 0 },
      camYaw,
      camPitch
    );
    const pose =
      state.mode === 'third'
        ? resolveCameraPose(
            idealPose,
            state.position,
            cameraBlocks,
            layout.ground
          )
        : idealPose;
    camera.position.set(pose.position.x, pose.position.y, pose.position.z);
    camera.lookAt(new Vector3(pose.target.x, pose.target.y, pose.target.z));
    playerRig.root.visible = state.mode !== 'first';
  };

  const wantsProcedural =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('model') === 'procedural';
  if (!wantsProcedural && quality === 'high') {
    void loadTankRig()
      .then((asset) => {
        glbAsset = asset;
        const painted = paintTankRig(
          asset,
          layout.player.color,
          layout.player.secondaryColor
        );
        painted.root.position.copy(playerRig.root.position);
        painted.root.rotation.y = playerRig.root.rotation.y;
        painted.root.add(playerLabel.sprite);
        scene.remove(playerRig.root);
        scene.add(painted.root);
        playerRig = painted;
        gunRestPosition.copy(painted.gun.position);
        recoil = 0;
        usingGlbTanks = true;

        for (const enemy of layout.enemies) {
          const root = enemyRoots.get(enemy.id);
          if (!root) continue;
          const model = paintTankRig(asset, enemy.color, enemy.secondaryColor);
          model.root.position.copy(root.position);
          model.root.rotation.copy(root.rotation);
          const label = enemyLabels.get(enemy.id);
          if (label) model.root.add(label.sprite);
          scene.remove(root);
          enemyRoots.set(enemy.id, model.root);
          enemyRigs.set(enemy.id, model);
          scene.add(model.root);
        }
      })
      .catch(() => {
        /* Keep the procedural tanks when the asset cannot load. */
      });
  }

  let frame = 0;
  let previous = performance.now();
  const sampler = createFrameSampler(120);
  const driver = new FixedStepDriver();
  const loop = (now: number) => {
    const delta = Math.min(0.1, (now - previous) / 1000);
    previous = now;
    /* Watch the real frame rate and step down once if the GPU cannot keep up. */
    sampler.add(delta);
    if (sampler.ready) {
      if (shouldDowngrade(quality, sampler.averageFps)) {
        quality = downgrade(quality);
        applyQuality(quality);
        onQualityChange?.(quality);
        if (quality === 'low' && usingGlbTanks) {
          const procedural = proceduralRigs.get('player');
          if (procedural) {
            const current = playerRig.root;
            scene.remove(current);
            procedural.root.position.copy(current.position);
            procedural.root.rotation.y = current.rotation.y;
            procedural.root.add(playerLabel.sprite);
            scene.add(procedural.root);
            playerRig = procedural;
            gunRestPosition.copy(procedural.gun.position);
            recoil = 0;
            usingGlbTanks = false;
          }
        }
      }
      sampler.reset();
    }
    const update = (delta: number) => {
      if (input) {
        playerRig.gun.position.copy(gunRestPosition);
        const previousPositions = new Map<string, { x: number; z: number }>([
          ['player', { x: state.position.x, z: state.position.z }],
          ...layout.enemies.map(
            (enemy) =>
              [enemy.id, { x: enemy.position.x, z: enemy.position.z }] as const
          ),
        ]);
        ramTimeMs += delta * 1000;
        const command = driveCommand(input.snapshot());
        const next = stepTank(
          state,
          { forward: command.forward, turn: command.turn },
          delta,
          layout
        );
        state.trackSpeed = next.trackSpeed;
        state.turnRate = next.turnRate;
        if (
          next.heading !== state.heading ||
          next.position !== state.position
        ) {
          const previousPosition = state.position;
          state.heading = next.heading;
          state.position = resolveObstacles(next.position, 1.9, layout.blocks);
          playerRig.root.position.set(
            state.position.x,
            state.position.y,
            state.position.z
          );
          const travelled =
            Math.hypot(
              state.position.x - previousPosition.x,
              state.position.z - previousPosition.z
            ) * Math.sign(next.trackSpeed);
          advanceRunningGear(playerRig, travelled);
          playerRig.root.rotation.y = next.heading;
        }
        if (command.turret !== 0) {
          state.turret = normaliseAngle(
            state.turret + command.turret * traverseSpeed * delta
          );
          playerRig.turret.rotation.y = state.turret;
        }

        const guidedAim = !rightHeld && command.turret === 0 && aim.ready;
        let targetWorld: number | null =
          rightHeld || command.turret !== 0 ? null : camYaw;
        if (guidedAim) {
          const bounds = canvas.getBoundingClientRect();
          const ndc = new Vector2(
            (aim.x / Math.max(1, bounds.width)) * 2 - 1,
            -(aim.y / Math.max(1, bounds.height)) * 2 + 1
          );
          raycaster.setFromCamera(ndc, camera);
          aimPoint.copy(
            resolveAimPoint(
              raycaster.ray,
              [...enemyRoots.values(), ground],
              SHELL_RANGE * 2
            )
          );
          const pivot = playerRig.turret.getWorldPosition(new Vector3());
          targetWorld = aimYaw(pivot, aimPoint);
          const gunPivot = playerRig.gun.getWorldPosition(new Vector3());
          gunPitch = stepGunPitch(
            gunPitch,
            aimPitch(gunPivot, aimPoint),
            elevationSpeed * delta
          );
          if (playerRig.gun.userData.pitchAxis === 'x') {
            playerRig.gun.rotation.x = gunPitch;
          } else {
            playerRig.gun.rotation.z = -gunPitch;
          }
        }

        if (targetWorld !== null) {
          onAimOffset?.(
            normaliseAngle(targetWorld - (state.heading + state.turret))
          );
          const localTarget = normaliseAngle(targetWorld - state.heading);
          state.turret = rotateTowards(
            state.turret,
            localTarget,
            traverseSpeed * delta
          );
          playerRig.turret.rotation.y = state.turret;
        }
        /* Enemies close the distance until they are inside their firing standoff. */
        const boundsRect = layout.playfield ?? layout.ground;
        const limitX = boundsRect.width / 2 - 2.4;
        const limitZ = boundsRect.depth / 2 - 2.4;
        for (const [slot, enemy] of layout.enemies.entries()) {
          const root = enemyRoots.get(enemy.id);
          if (!root || enemy.passive) continue;
          const goal = enemyGoal(
            enemy,
            { x: state.position.x, z: state.position.z },
            groupSpread(slot, layout.enemies.length, difficulty) *
              layout.enemies.length,
            layout.enemies.length,
            layout.blocks
          );
          const step = advanceEnemy(
            enemy,
            goal,
            combat.playerDestroyed ? 0 : (enemySpeeds.get(enemy.id) ?? 0),
            delta,
            boundsRect
          );
          if (step.moved) {
            enemy.position = resolveObstacles(
              step.position,
              1.7,
              layout.blocks
            );
            enemy.heading = step.heading;
          }
          root.position.set(
            enemy.position.x,
            enemy.position.y,
            enemy.position.z
          );
          root.rotation.y = enemy.heading;
          const rig = enemyRigs.get(enemy.id);
          const aimState = enemyAimStates.get(enemy.id);
          if (rig && aimState) {
            const target = new Vector3(
              state.position.x,
              state.position.y,
              state.position.z
            );
            Object.assign(
              aimState,
              aimEnemyWeapon(
                aimState,
                rig.turret.getWorldPosition(new Vector3()),
                rig.gun.getWorldPosition(new Vector3()),
                target,
                enemy.heading,
                (enemy.combat?.turretTraverseSpeed ?? 1.2) * delta,
                (enemy.combat?.gunElevationSpeed ?? 0.7) * delta
              )
            );
            rig.turret.rotation.y = aimState.turret;
            rig.gun.rotation.x = aimState.pitch;
          }
        }

        /* Hull-to-hull separation: enemies and the player never share a spot. */
        const bodies = [
          { id: 'player', position: state.position, radius: 2.6 },
          ...layout.enemies.map((enemy) => ({
            id: enemy.id,
            position: enemy.position,
            radius: 2.6,
          })),
        ];
        const ramImpacts = calculateRamImpacts(
          bodies.map((body) => {
            const placement =
              body.id === 'player'
                ? layout.player
                : layout.enemies.find((enemy) => enemy.id === body.id)!;
            return {
              id: body.id,
              mass: placement.combat?.mass ?? 100,
              armorReduction: placement.combat?.armorReduction ?? 0,
              radius: body.radius,
              previous: previousPositions.get(body.id) ?? {
                x: body.position.x,
                z: body.position.z,
              },
              current: { x: body.position.x, z: body.position.z },
            };
          }),
          delta,
          ramCooldowns,
          ramTimeMs
        );
        const ramResult = applyRamImpacts(combat, ramImpacts);
        combat = ramResult.state;
        for (const impact of ramImpacts) {
          ramCooldowns.set(impact.pairKey, ramTimeMs);
          logCombatEvent('ram_impact', {
            enemyId: impact.secondId,
            damageToEnemy: impact.damageToSecond,
            damageToPlayer: impact.damageToFirst,
            relativeSpeed: Math.round(impact.relativeSpeed),
          });
          const root = enemyRoots.get(impact.secondId);
          if (root) {
            const flash = new Mesh(
              new RingGeometry(0.3, 0.65, 20),
              new MeshBasicMaterial({
                color: 0xffc36a,
                transparent: true,
                opacity: 0.9,
                side: DoubleSide,
              })
            );
            flash.rotation.x = -Math.PI / 2;
            flash.position.copy(root.position);
            flash.position.y += 0.35;
            effects.spawn(flash, 0.28, 2.5);
            hitFeedback.spawnRam(
              root.position,
              impact.damageToSecond,
              config.locale
            );
          }
        }
        destroyEnemies(ramResult.destroyed, 'ram');
        if (ramImpacts.length > 0) publish();

        for (let a = 0; a < bodies.length; a += 1) {
          for (let b = a + 1; b < bodies.length; b += 1) {
            const first = bodies[a]!;
            const second = bodies[b]!;
            const dx = second.position.x - first.position.x;
            const dz = second.position.z - first.position.z;
            const distance = Math.hypot(dx, dz);
            const minimum = first.radius + second.radius;
            if (distance <= 0.0001 || distance >= minimum) continue;
            const push = (minimum - distance) / 2;
            const nx = (dx / distance) * push;
            const nz = (dz / distance) * push;
            if (first.id !== 'player') {
              first.position.x -= nx;
              first.position.z -= nz;
            }
            if (second.id !== 'player') {
              second.position.x += nx;
              second.position.z += nz;
            }
            if (first.id === 'player') {
              state.position.x -= nx;
              state.position.z -= nz;
            }
            if (second.id === 'player') {
              state.position.x += nx;
              state.position.z += nz;
            }
          }
        }
        /* Separation can push hulls outward or into walls, so resolve both again. */
        state.position = resolveObstacles(
          {
            x: Math.max(-limitX, Math.min(limitX, state.position.x)),
            y: state.position.y,
            z: Math.max(-limitZ, Math.min(limitZ, state.position.z)),
          },
          1.9,
          layout.blocks
        );
        for (const enemy of layout.enemies) {
          enemy.position = resolveObstacles(
            {
              x: Math.max(-limitX, Math.min(limitX, enemy.position.x)),
              y: enemy.position.y,
              z: Math.max(-limitZ, Math.min(limitZ, enemy.position.z)),
            },
            1.7,
            layout.blocks
          );
          const root = enemyRoots.get(enemy.id);
          if (!root) continue;
          root.position.set(
            enemy.position.x,
            enemy.position.y,
            enemy.position.z
          );
        }
        playerRig.root.position.copy(
          new Vector3(state.position.x, state.position.y, state.position.z)
        );
        const muzzle = playerRig.muzzle.getWorldPosition(new Vector3());
        const direction = playerRig.muzzle.getWorldDirection(new Vector3());
        const sight = projectGunSight(
          muzzle,
          direction,
          aim.ready ? muzzle.distanceTo(aimPoint) : SHELL_RANGE,
          camera
        );
        const reticleBounds = canvas.getBoundingClientRect();
        const reticleAligned =
          !guidedAim ||
          aimAlignmentError(muzzle, direction, aimPoint) <= FIRE_AIM_TOLERANCE;
        onReticle?.(
          ((sight.x + 1) / 2) * reticleBounds.width,
          ((1 - sight.y) / 2) * reticleBounds.height,
          reticleBounds.width,
          reticleBounds.height
        );
        if (aim.ready) {
          onPointerReticle?.(
            aim.x,
            aim.y,
            reticleBounds.width,
            reticleBounds.height,
            reticleAligned
          );
        }

        const beforeAmmo = combat.ammo;
        combat = advanceReload(combat, delta);
        combat = tickCooldown(combat, delta);
        if (combat.ammo !== beforeAmmo) onAmmo?.(combat.ammo, MAX_AMMO);
        const aligned =
          !guidedAim ||
          aimAlignmentError(muzzle, direction, aimPoint) <= FIRE_AIM_TOLERANCE;
        if (canFire(combat) && aligned && input.consumeFireRequest()) {
          const baseAim = {
            x: muzzle.x + direction.x * SHELL_RANGE,
            y: muzzle.y + direction.y * SHELL_RANGE,
            z: muzzle.z + direction.z * SHELL_RANGE,
          };
          const scattered = scatterAimPoint(baseAim, Math.random, dispersion);
          const shotPitch = clampGunPitch(
            aimPitch(muzzle, {
              x: scattered.x,
              y: baseAim.y,
              z: scattered.z,
            })
          );
          combat = spawnShell(
            combat,
            muzzle,
            aimYaw(muzzle, scattered),
            shotPitch,
            muzzle.y,
            config.player.projectileDamage,
            config.player.projectilePenetration,
            config.player.fireCooldownMs
          );
          recoil = 0.12;
          const flash = new Mesh(
            new SphereGeometry(0.42, 8, 8),
            new MeshBasicMaterial({
              color: 0xffd27a,
              transparent: true,
              opacity: 0.95,
            })
          );
          flash.position.copy(muzzle);
          effects.spawn(flash, 0.14, 5);
          publish();
          onAmmo?.(combat.ammo, MAX_AMMO);
        }

        if (!combat.playerDestroyed) {
          const aliveEnemies = layout.enemies.filter((enemy) =>
            enemyRoots.has(enemy.id)
          );
          const fire = advanceEnemyFire(
            combat,
            aliveEnemies,
            { x: state.position.x, z: state.position.z },
            delta,
            9,
            enemyReloadMs(difficulty)
          );
          combat = fire.state;
          for (const launch of fire.launches) {
            const rig = enemyRigs.get(launch.sourceId);
            if (rig) {
              const muzzle = rig.muzzle.getWorldPosition(new Vector3());
              const direction = rig.muzzle.getWorldDirection(new Vector3());
              const target = new Vector3(
                state.position.x,
                state.position.y,
                state.position.z
              );
              if (
                aimAlignmentError(muzzle, direction, target) >
                FIRE_AIM_TOLERANCE
              ) {
                continue;
              }
              Object.assign(launch, {
                x: muzzle.x,
                y: muzzle.y,
                z: muzzle.z,
                heading: aimYaw(muzzle, target),
                pitch: aimPitch(muzzle, target),
              });
            }
            combat = spawnEnemyShell(combat, launch);
          }
          if (combat.enemyShells.length > 0) {
            const incoming = advanceEnemyShells(
              combat,
              delta,
              {
                x: state.position.x,
                z: state.position.z,
              },
              config.player.armorReduction,
              config.player.armorProfile,
              state.heading
            );
            combat = incoming.state;
            if (incoming.damage > 0) publish();
          }
        }

        if (combat.shells.length > 0) {
          const alive = layout.enemies.filter((enemy) =>
            enemyRoots.has(enemy.id)
          );
          const result = advanceShells(
            combat,
            delta,
            alive,
            config.player.projectileSpeed * 0.1,
            meshHitTest
          );
          combat = result.state;
          for (const impact of result.impacts) {
            hitFeedback.spawn(impact, config.locale);
            logCombatEvent('player_projectile_hit_enemy', {
              enemyId: impact.enemyId,
              damage: impact.damage,
              zone: impact.zone,
              outcome: impact.outcome,
              impactAngleDegrees: impact.impactAngleDegrees,
            });
          }
          destroyEnemies(result.destroyed, 'shell');
          if (result.destroyed.length > 0) publish();
        }
        playerLabel.update(combat.playerHealth, combat.playerMaxHealth);
        updateLabelVisibility(
          playerLabel,
          reticleBounds.width,
          reticleBounds.height
        );
        for (const enemy of layout.enemies) {
          const label = enemyLabels.get(enemy.id);
          if (!label) continue;
          label.update(
            combat.enemyHealth[enemy.id] ?? 0,
            enemy.combat?.maxHealth ?? 100
          );
          updateLabelVisibility(
            label,
            reticleBounds.width,
            reticleBounds.height
          );
        }
        playerRig.gun.translateX(-recoil);
        recoil = Math.max(0, recoil - delta * 0.65);
      }
    };
    driver.advance(delta, update);

    effects.update(delta, combat);
    hitFeedback.update(delta);
    applyCamera();
    renderer.render(scene, camera);
    frame = requestAnimationFrame(loop);
  };
  applyCamera();
  renderer.render(scene, camera);
  frame = requestAnimationFrame(loop);

  return {
    setMode(mode) {
      state.mode = mode;
      applyCamera();
    },
    applyAnswer(correct, reward) {
      const result = applyAnswerCombo(combo, correct);
      combo = result.state;
      combat = correct
        ? loadAmmo(combat, reward + result.bonusAmmo)
        : applyWrongAnswer(combat);
      onAmmo?.(combat.ammo, MAX_AMMO);
      onCombo?.(combo.streak, result.bonusAmmo);
    },
    getMode() {
      return state.mode;
    },
    dispose() {
      cancelAnimationFrame(frame);
      globalThis.removeEventListener('resize', resize);
      observer?.disconnect();
      playerLabel.dispose();
      for (const label of enemyLabels.values()) label.dispose();
      effects.dispose();
      hitFeedback.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
