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
  Plane,
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
  resolveObstacles,
  stepEnemyToward,
  stepTank,
  type CameraMode,
  type SceneLayout,
} from './battle-scene-model.js';
import { driveCommand, normaliseAngle } from './battle-input.js';
import { aimYaw, rotateTowards, scatterAimPoint } from './battle-aim.js';
import { buildTankModel } from './tank-model.js';
import { loadTankAsset, paintTank } from './tank-asset.js';
import { advanceReload } from './battle-combat.js';
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
  muzzlePoint,
  spawnEnemyShell,
  spawnShell,
  tickCooldown,
} from './battle-combat.js';
import { Object3D } from 'three';
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

function buildGround(layout: SceneLayout): Group {
  const ground = new Group();
  /* The ground matches the playable bounds, so the edge you see is the edge you hit. */
  const visualWidth = layout.ground.width;
  const visualDepth = layout.ground.depth;
  const geometry = new PlaneGeometry(visualWidth, visualDepth, 64, 64);
  const attribute = geometry.getAttribute('position');
  for (let index = 0; index < attribute.count; index += 1) {
    const x = attribute.getX(index);
    const y = attribute.getY(index);
    attribute.setZ(index, Math.sin(x * 0.25) * 0.12 + Math.cos(y * 0.21) * 0.1);
  }
  geometry.computeVertexNormals();

  const floor = new Mesh(
    geometry,
    new MeshStandardMaterial({ color: 0x6f7550, roughness: 0.95 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  ground.add(floor);

  const grid = new GridHelper(visualWidth, 90, 0x8d9a63, 0x7b8757);
  grid.material.opacity = 0.22;
  grid.material.transparent = true;
  grid.position.y = 0.04;
  ground.add(grid);

  for (const block of layout.blocks) {
    const mesh = new Mesh(
      new BoxGeometry(block.size[0], block.size[1], block.size[2]),
      new MeshStandardMaterial({ color: 0x8b8570, roughness: 0.85 })
    );
    mesh.position.set(block.position.x, block.position.y, block.position.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    ground.add(mesh);
  }
  return ground;
}

/** A low fence around the walkable field, so the ground edge never shows. */
function buildFence(layout: SceneLayout): Group {
  const group = new Group();
  const bounds = layout.ground;
  const halfWidth = bounds.width / 2 - 1;
  const halfDepth = bounds.depth / 2 - 1;
  const material = new MeshStandardMaterial({
    color: 0x2a352c,
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
  onReticle?: (x: number, y: number, width: number, height: number) => void
): Battle3DHandle {
  const layout = buildSceneLayout(config);
  const scene = new Scene();
  scene.background = new Color(0x9fb0b8);
  scene.fog = new Fog(0x8d9a7c, 60, 190);

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

  const ground = buildGround(layout);
  scene.add(ground);
  /* A distant skirt keeps the horizon filled; the fence marks the real edge. */
  const skirt = new Mesh(
    new PlaneGeometry(600, 600),
    new MeshStandardMaterial({ color: 0x6b7350, roughness: 1, metalness: 0 })
  );
  skirt.rotation.x = -Math.PI / 2;
  skirt.position.y = -0.02;
  skirt.receiveShadow = true;
  scene.add(skirt);
  scene.add(buildFence(layout));

  let gunRig = new Object3D();
  let playerRig: { root: Group; turret: Object3D } = buildTankModel(
    layout.player,
    true
  );
  const playerMesh = playerRig.root;
  scene.add(playerMesh);
  gunRig =
    (playerRig.turret.userData.gun as Object3D | undefined) ?? new Object3D();
  const proceduralRigs = new Map<string, { root: Group; turret: Object3D }>();
  proceduralRigs.set('player', playerRig);
  let usingGlbTanks = false;
  const effects: Array<{
    mesh: Mesh;
    ttl: number;
    life: number;
    growth: number;
  }> = [];
  const spawnEffect = (mesh: Mesh, life: number, growth: number) => {
    scene.add(mesh);
    effects.push({ mesh, ttl: life, life, growth });
  };
  const enemySpeeds = new Map<string, number>();
  for (const enemy of config.enemies) {
    enemySpeeds.set(enemy.id, enemy.speed * 0.06);
  }
  const enemyRoots = new Map<string, Group>();
  for (const enemy of layout.enemies) {
    const rig = buildTankModel(enemy, false);
    enemyRoots.set(enemy.id, rig.root);
    scene.add(rig.root);
  }

  const shellGeometry = new SphereGeometry(0.16, 8, 8);
  const shellMaterial = new MeshStandardMaterial({
    color: 0xffd27a,
    emissive: 0x8a5a12,
    roughness: 0.4,
  });
  const shellMeshes = new Map<number, Mesh>();
  const enemyShellMeshes = new Map<number, Mesh>();
  const enemyShellMaterial = new MeshStandardMaterial({
    color: 0xff7a5c,
    emissive: 0x7a2412,
    roughness: 0.45,
  });
  let combat = createCombatState(
    layout.enemies.length,
    1,
    config.player.maxHealth
  );
  const totalEnemies = layout.enemies.length;
  let destroyedCount = 0;

  const publish = () => {
    onState?.({
      enemiesRemaining: combat.enemiesRemaining,
      shotsFired: combat.shotsFired,
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
  const dispersion = config.player.dispersionRadius;
  let rightHeld = false;
  const raycaster = new Raycaster();
  const aimPoint = new Vector3();
  const gunPlane = new Plane(new Vector3(0, 1, 0), -1.2);
  let camYaw = layout.player.heading;
  let camPitch = 0.15;
  /* Screen-space aim point (CSS pixels inside the canvas); the reticle follows it. */
  const aim = { x: 0, y: 0, ready: false };
  const state = {
    mode: 'third' as CameraMode,
    heading: layout.player.heading,
    position: { ...layout.player.position },
    turret: 0,
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
  /*
   * Mouse look uses pointer lock, like a browser FPS: the cursor hides, so it
   * can never wander off the window while it steers the camera.
   */
  const locked = () => document.pointerLockElement === canvas;
  const look = (movementX: number, movementY: number) => {
    camYaw -= movementX * 0.0016;
    camPitch = Math.max(-0.5, Math.min(0.8, camPitch - movementY * 0.0011));
  };

  canvas.addEventListener('pointermove', (event) => {
    look(event.movementX, event.movementY);
    const bounds = canvas.getBoundingClientRect();
    if (locked()) {
      aim.x = Math.max(0, Math.min(bounds.width, aim.x + event.movementX));
      aim.y = Math.max(0, Math.min(bounds.height, aim.y + event.movementY));
    } else {
      aim.x = event.clientX - bounds.left;
      aim.y = event.clientY - bounds.top;
    }
    aim.ready = true;
    onReticle?.(aim.x, aim.y, bounds.width, bounds.height);
  });
  canvas.addEventListener('pointerdown', (event) => {
    if (event.button === 2) rightHeld = true;
    if (event.button !== 0) return;
    /* The first click both grabs the pointer and sends the shot, so the gun
       never feels dead while the player is still locking in. */
    if (!locked()) {
      void canvas.requestPointerLock?.();
      host.dataset.pointerLock = 'on';
    }
    input?.setCommand('fire', true, 'pointer');
  });
  globalThis.addEventListener('pointerup', (event) => {
    if (event.button === 0) input?.setCommand('fire', false, 'pointer');
    if (event.button === 2) rightHeld = false;
  });
  document.addEventListener('pointerlockchange', () => {
    canvas.classList.toggle('battle-canvas--locked', locked());
    host.dataset.pointerLock = locked() ? 'on' : 'off';
    onPointerLock?.(locked());
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  const observer =
    typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(() => resize());
  observer?.observe(host);

  const applyCamera = () => {
    const pose = cameraPose(
      state.mode,
      { ...state, heading: 0 },
      camYaw,
      camPitch
    );
    camera.position.set(pose.position.x, pose.position.y, pose.position.z);
    camera.lookAt(new Vector3(pose.target.x, pose.target.y, pose.target.z));
    playerMesh.visible = state.mode !== 'first';
  };

  /*
   * The procedural tanks stay the default: the generated GLB reads flatter than
   * the layered procedural hull at close range. ?model=glb opts in until a real
   * model replaces the file.
   */
  const wantsGlb =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('model') === 'glb';
  if (wantsGlb && quality !== 'low') {
    void loadTankAsset()
      .then((asset) => {
        const painted = paintTank(asset, layout.player.color);
        painted.root.position.copy(playerRig.root.position);
        painted.root.rotation.y = playerRig.root.rotation.y;
        scene.remove(playerRig.root);
        scene.add(painted.root);
        playerRig = painted;
        gunRig =
          (painted.turret.userData.gun as Object3D | undefined) ?? gunRig;
        usingGlbTanks = true;

        for (const enemy of layout.enemies) {
          const root = enemyRoots.get(enemy.id);
          if (!root) continue;
          const model = paintTank(asset, enemy.color);
          proceduralRigs.set(`enemy:${enemy.id}`, {
            root: root.children[0] as Group,
            turret: new Group(),
          });
          root.clear();
          root.add(model.root);
          root.position.set(
            enemy.position.x,
            enemy.position.y,
            enemy.position.z
          );
          root.rotation.y = enemy.heading;
        }
      })
      .catch(() => {
        /* Keep the procedural tanks when the asset cannot load. */
      });
  }

  let frame = 0;
  let previous = performance.now();
  const sampler = createFrameSampler(120);
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
            scene.add(procedural.root);
            playerRig = procedural;
            usingGlbTanks = false;
          }
        }
      }
      sampler.reset();
    }
    if (input) {
      const command = driveCommand(input.snapshot());
      const next = stepTank(
        state,
        { forward: command.forward, turn: command.turn },
        delta,
        layout
      );
      if (next.heading !== state.heading || next.position !== state.position) {
        camYaw += next.heading - state.heading;
        state.heading = next.heading;
        state.position = resolveObstacles(next.position, 1.9, layout.blocks);
        playerMesh.position.set(
          next.position.x,
          next.position.y,
          next.position.z
        );
        const travelled =
          Math.hypot(
            next.position.x - state.position.x,
            next.position.z - state.position.z
          ) || 0;
        const wheels = playerRig.root.userData.wheels as
          Array<{ rotation: { z: number } }> | undefined;
        for (const wheel of wheels ?? []) {
          wheel.rotation.z -= travelled / 0.3;
        }
        playerMesh.rotation.y = next.heading;
      }
      if (command.turret !== 0) {
        state.turret = normaliseAngle(
          state.turret + command.turret * traverseSpeed * delta
        );
        playerRig.turret.rotation.y = state.turret;
      }

      /*
       * The gun follows the centre of the view, so the reticle is the aim point.
       * Holding the right button freezes the turret while the camera keeps turning.
       */
      let targetWorld: number | null = rightHeld ? null : camYaw;
      if (!rightHeld && aim.ready) {
        const bounds = canvas.getBoundingClientRect();
        const ndc = new Vector2(
          (aim.x / Math.max(1, bounds.width)) * 2 - 1,
          -(aim.y / Math.max(1, bounds.height)) * 2 + 1
        );
        raycaster.setFromCamera(ndc, camera);
        const hit = raycaster.ray.intersectPlane(gunPlane, aimPoint);
        if (hit) {
          targetWorld = aimYaw(
            { x: state.position.x, z: state.position.z },
            { x: aimPoint.x, z: aimPoint.z }
          );
          const distance = Math.hypot(
            aimPoint.x - state.position.x,
            aimPoint.z - state.position.z
          );
          const elevation = Math.atan2(1.2 - aimPoint.y, distance);
          gunRig.rotation.z = Math.max(-0.16, Math.min(0.12, -elevation));
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
      for (const enemy of layout.enemies) {
        const root = enemyRoots.get(enemy.id);
        if (!root) continue;
        const step = stepEnemyToward(
          enemy,
          { x: state.position.x, z: state.position.z },
          combat.playerDestroyed ? 0 : (enemySpeeds.get(enemy.id) ?? 0),
          delta,
          8,
          boundsRect
        );
        if (step.moved) {
          enemy.position = resolveObstacles(step.position, 1.7, layout.blocks);
          enemy.heading = step.heading;
        }
        root.position.set(enemy.position.x, enemy.position.y, enemy.position.z);
        root.rotation.y = enemy.heading;
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
        root.position.set(enemy.position.x, enemy.position.y, enemy.position.z);
      }
      playerRig.root.position.copy(
        new Vector3(state.position.x, state.position.y, state.position.z)
      );

      const beforeAmmo = combat.ammo;
      combat = advanceReload(combat, delta);
      combat = tickCooldown(combat, delta);
      if (combat.ammo !== beforeAmmo) onAmmo?.(combat.ammo, MAX_AMMO);
      if (canFire(combat) && input.consumeFireRequest()) {
        const muzzle = muzzlePoint(
          { x: state.position.x, z: state.position.z },
          state.heading,
          state.turret,
          layout.player.barrelLength
        );
        const turretWorld = state.heading + state.turret;
        const horizontal = Math.cos(camPitch);
        const baseAim = {
          x: muzzle.x + Math.cos(turretWorld) * SHELL_RANGE * horizontal,
          z: muzzle.z - Math.sin(turretWorld) * SHELL_RANGE * horizontal,
        };
        const scattered = scatterAimPoint(baseAim, Math.random, dispersion);
        combat = spawnShell(
          combat,
          muzzle,
          aimYaw(muzzle, scattered),
          camPitch
        );
        const flash = new Mesh(
          new SphereGeometry(0.42, 8, 8),
          new MeshBasicMaterial({
            color: 0xffd27a,
            transparent: true,
            opacity: 0.95,
          })
        );
        flash.position.set(muzzle.x, 1.2, muzzle.z);
        spawnEffect(flash, 0.14, 5);
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
          delta
        );
        combat = fire.state;
        for (const launch of fire.launches) {
          combat = spawnEnemyShell(combat, launch);
        }
        if (combat.enemyShells.length > 0) {
          const incoming = advanceEnemyShells(combat, delta, {
            x: state.position.x,
            z: state.position.z,
          });
          combat = incoming.state;
          if (incoming.damage > 0) publish();
        }
      }

      if (combat.shells.length > 0) {
        const alive = layout.enemies.filter((enemy) =>
          enemyRoots.has(enemy.id)
        );
        const result = advanceShells(combat, delta, alive);
        combat = result.state;
        for (const id of result.destroyed) {
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
            spawnEffect(impact, 0.55, 4);
            scene.remove(root);
            enemyRoots.delete(id);
          }
          destroyedCount += 1;
        }
        if (result.destroyed.length > 0) publish();
      }
    }

    for (let index = effects.length - 1; index >= 0; index -= 1) {
      const effect = effects[index]!;
      effect.ttl -= delta;
      const material = effect.mesh.material as MeshBasicMaterial;
      if (effect.ttl <= 0) {
        scene.remove(effect.mesh);
        effect.mesh.geometry.dispose();
        material.dispose();
        effects.splice(index, 1);
        continue;
      }
      const scale = 1 + (1 - effect.ttl / effect.life) * effect.growth;
      effect.mesh.scale.setScalar(scale);
      material.opacity = Math.max(0, effect.ttl / effect.life) * 0.9;
    }

    for (const shell of combat.shells) {
      let mesh = shellMeshes.get(shell.id);
      if (!mesh) {
        mesh = new Mesh(shellGeometry, shellMaterial);
        shellMeshes.set(shell.id, mesh);
        scene.add(mesh);
      }
      mesh.position.set(shell.x, 0.9, shell.z);
    }
    for (const [id, mesh] of shellMeshes) {
      if (!combat.shells.some((shell) => shell.id === id)) {
        scene.remove(mesh);
        shellMeshes.delete(id);
      }
    }

    for (const shell of combat.enemyShells) {
      let mesh = enemyShellMeshes.get(shell.id);
      if (!mesh) {
        mesh = new Mesh(shellGeometry, enemyShellMaterial);
        enemyShellMeshes.set(shell.id, mesh);
        scene.add(mesh);
      }
      mesh.position.set(shell.x, 0.9, shell.z);
    }
    for (const [id, mesh] of enemyShellMeshes) {
      if (!combat.enemyShells.some((shell) => shell.id === id)) {
        scene.remove(mesh);
        enemyShellMeshes.delete(id);
      }
    }
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
      combat = correct ? loadAmmo(combat, reward) : applyWrongAnswer(combat);
      onAmmo?.(combat.ammo, MAX_AMMO);
    },
    getMode() {
      return state.mode;
    },
    dispose() {
      cancelAnimationFrame(frame);
      globalThis.removeEventListener('resize', resize);
      observer?.disconnect();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
