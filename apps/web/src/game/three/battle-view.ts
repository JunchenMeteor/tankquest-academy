/**
 * Three.js battle view.
 * Owns the WebGL scene, tank meshes and camera; game rules stay in the existing
 * session runtime, and the pure geometry lives in battle-scene-model.
 */
import {
  AmbientLight,
  BoxGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
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
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three';

import {
  buildSceneLayout,
  cameraPose,
  stepEnemyToward,
  stepTank,
  type CameraMode,
  type SceneLayout,
  type TankPlacement,
} from './battle-scene-model.js';
import { driveCommand, normaliseAngle } from './battle-input.js';
import { aimYaw, rotateTowards, scatterAimPoint } from './battle-aim.js';
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

const TRACK_COLOR = 0x1a201d;

function buildTank(
  placement: TankPlacement,
  isPlayer: boolean
): { root: Group; turret: Group } {
  const group = new Group();
  const turretGroup = new Group();
  const body = new MeshStandardMaterial({
    color: placement.color,
    roughness: 0.5,
    metalness: 0.72,
  });
  const dark = new MeshStandardMaterial({
    color: 0x3a453f,
    roughness: 0.65,
    metalness: 0.7,
  });
  const track = new MeshStandardMaterial({
    color: TRACK_COLOR,
    roughness: 0.95,
  });

  const [hullWidth, hullHeight, hullDepth] = placement.hull;
  const hull = new Mesh(
    new BoxGeometry(hullWidth, hullHeight, hullDepth),
    body
  );
  hull.position.y = hullHeight / 2 + 0.28;
  hull.castShadow = true;
  hull.receiveShadow = true;
  group.add(hull);

  const glacis = new Mesh(new BoxGeometry(0.9, 0.7, hullDepth), body);
  glacis.position.set(hullWidth / 2, hullHeight / 2 + 0.44, 0);
  glacis.rotation.z = -0.5;
  glacis.castShadow = true;
  group.add(glacis);

  for (const z of [-hullDepth / 2 - 0.22, hullDepth / 2 + 0.22]) {
    const belt = new Mesh(new BoxGeometry(hullWidth + 0.5, 0.5, 0.42), track);
    belt.position.set(0, 0.25, z);
    belt.castShadow = true;
    belt.receiveShadow = true;
    group.add(belt);
    for (let index = -2; index <= 2; index += 1) {
      const wheel = new Mesh(new CylinderGeometry(0.26, 0.26, 0.46, 12), dark);
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(index * 0.72, 0.28, z);
      wheel.castShadow = true;
      group.add(wheel);
    }
  }

  const turret = new Mesh(
    new CylinderGeometry(
      placement.turretRadius,
      placement.turretRadius * 1.12,
      0.62,
      8
    ),
    body
  );
  turret.position.y = hullHeight + 0.58;
  turret.castShadow = true;
  turretGroup.add(turret);

  const gun = new Mesh(
    new CylinderGeometry(0.11, 0.13, placement.barrelLength, 10),
    dark
  );
  gun.rotation.z = Math.PI / 2;
  gun.position.set(
    placement.barrelLength / 2 + placement.turretRadius * 0.75,
    hullHeight + 0.62,
    0
  );
  gun.castShadow = true;
  turretGroup.add(gun);

  const brake = new Mesh(new CylinderGeometry(0.19, 0.19, 0.42, 10), dark);
  brake.rotation.z = Math.PI / 2;
  brake.position.set(
    placement.barrelLength + placement.turretRadius * 0.75,
    hullHeight + 0.62,
    0
  );
  brake.castShadow = true;
  turretGroup.add(brake);

  group.position.set(
    placement.position.x,
    placement.position.y,
    placement.position.z
  );
  group.rotation.y = placement.heading;
  group.userData.isPlayer = isPlayer;
  turretGroup.position.y = 0;
  group.add(turretGroup);
  return { root: group, turret: turretGroup };
}

function buildGround(layout: SceneLayout): Group {
  const ground = new Group();
  /* The visible ground runs past the playable bounds so the edge never shows. */
  const visualWidth = layout.ground.width * 2.4;
  const visualDepth = layout.ground.depth * 2.4;
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

export function createBattleView(
  host: HTMLElement,
  config: RuntimeLevelConfig,
  input?: GameInputController,
  onState?: (state: RuntimeState) => void,
  onAmmo?: (ammo: number, max: number) => void
): Battle3DHandle {
  const layout = buildSceneLayout(config);
  const scene = new Scene();
  scene.background = new Color(0x1c2a22);
  scene.fog = new Fog(0x1c2a22, 70, 160);

  const renderer = new WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio ?? 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;
  renderer.domElement.dataset.renderMode = '3d';
  host.appendChild(renderer.domElement);

  const key = new DirectionalLight(0xfff4d6, 4.2);
  key.position.set(-14, 18, 10);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -30;
  key.shadow.camera.right = 30;
  key.shadow.camera.top = 30;
  key.shadow.camera.bottom = -30;
  scene.add(key);
  scene.add(new HemisphereLight(0xcfe0ff, 0x5a4c36, 1.6));
  scene.add(new AmbientLight(0xffffff, 0.45));

  const ground = buildGround(layout);
  scene.add(ground);

  const playerRig = buildTank(layout.player, true);
  const playerMesh = playerRig.root;
  scene.add(playerMesh);
  const enemySpeeds = new Map<string, number>();
  for (const enemy of config.enemies) {
    enemySpeeds.set(enemy.id, enemy.speed * 0.06);
  }
  const enemyRoots = new Map<string, Group>();
  for (const enemy of layout.enemies) {
    const rig = buildTank(enemy, false);
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
  let camYaw = layout.player.heading;
  let camPitch = 0.34;
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

  const canvas = renderer.domElement;
  canvas.addEventListener('pointermove', (event) => {
    /* The view always follows the mouse; the right button only freezes the gun. */
    camYaw += event.movementX * 0.0016;
    camPitch = Math.max(
      -0.35,
      Math.min(0.75, camPitch - event.movementY * 0.0011)
    );
  });
  canvas.addEventListener('pointerdown', (event) => {
    if (event.button === 2) rightHeld = true;
    if (event.button === 0) input?.setCommand('fire', true, 'pointer');
  });
  globalThis.addEventListener('pointerup', (event) => {
    if (event.button === 0) input?.setCommand('fire', false, 'pointer');
  });
  globalThis.addEventListener('pointerup', (event) => {
    if (event.button === 2) rightHeld = false;
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

  let frame = 0;
  let previous = performance.now();
  const loop = (now: number) => {
    const delta = Math.min(0.05, (now - previous) / 1000);
    previous = now;
    if (input) {
      const command = driveCommand(input.snapshot());
      const next = stepTank(
        state,
        { forward: command.forward, turn: command.turn },
        delta,
        layout
      );
      if (next.heading !== state.heading || next.position !== state.position) {
        state.heading = next.heading;
        state.position = next.position;
        playerMesh.position.set(
          next.position.x,
          next.position.y,
          next.position.z
        );
        playerMesh.rotation.y = next.heading;
      }
      if (command.turret !== 0) {
        state.turret = normaliseAngle(
          state.turret + command.turret * traverseSpeed * delta
        );
        playerRig.turret.rotation.y = state.turret;
        playerRig.turret.rotation.z = -camPitch;
      }

      /*
       * The gun follows the centre of the view, so the reticle is the aim point.
       * Holding the right button freezes the turret while the camera keeps turning.
       */
      const targetWorld: number | null = rightHeld ? null : camYaw;

      if (targetWorld !== null) {
        const localTarget = normaliseAngle(targetWorld - state.heading);
        state.turret = rotateTowards(
          state.turret,
          localTarget,
          traverseSpeed * delta
        );
        playerRig.turret.rotation.y = state.turret;
        playerRig.turret.rotation.z = -camPitch;
      }

      /* Enemies close the distance until they are inside their firing standoff. */
      for (const enemy of layout.enemies) {
        const root = enemyRoots.get(enemy.id);
        if (!root) continue;
        const step = stepEnemyToward(
          enemy,
          { x: state.position.x, z: state.position.z },
          enemySpeeds.get(enemy.id) ?? 0,
          delta,
          8,
          layout.ground
        );
        if (step.moved) {
          enemy.position = step.position;
          enemy.heading = step.heading;
          root.position.set(step.position.x, step.position.y, step.position.z);
          root.rotation.y = step.heading;
        }
      }

      combat = tickCooldown(combat, delta);
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
            scene.remove(root);
            enemyRoots.delete(id);
          }
          destroyedCount += 1;
        }
        if (result.destroyed.length > 0) publish();
      }
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
