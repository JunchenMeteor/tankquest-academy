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
  stepTank,
  type CameraMode,
  type SceneLayout,
  type TankPlacement,
} from './battle-scene-model.js';
import { driveCommand, normaliseAngle } from './battle-input.js';
import {
  advanceShells,
  createCombatState,
  muzzlePoint,
  spawnShell,
  tickCooldown,
} from './battle-combat.js';
import type { GameInputController } from '../input/GameInputController.js';
import type { RuntimeState } from '../runtime/types.js';
import type { RuntimeLevelConfig } from '../runtime/types.js';

export interface Battle3DHandle {
  setMode(mode: CameraMode): void;
  getMode(): CameraMode;
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
  const geometry = new PlaneGeometry(
    layout.ground.width,
    layout.ground.depth,
    48,
    48
  );
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

  const grid = new GridHelper(layout.ground.width, 60, 0x8d9a63, 0x7b8757);
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
  onState?: (state: RuntimeState) => void
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
  let combat = createCombatState(layout.enemies.length);
  const totalEnemies = layout.enemies.length;
  let destroyedCount = 0;

  const publish = () => {
    onState?.({
      enemiesRemaining: combat.enemiesRemaining,
      shotsFired: combat.shotsFired,
      playerHealth: config.player.maxHealth,
      playerMaxHealth: config.player.maxHealth,
      playerDestroyed: false,
      objectiveComplete: destroyedCount >= totalEnemies,
      objectiveType: 'eliminate',
      objectiveCurrent: destroyedCount,
      objectiveTarget: totalEnemies,
    });
  };
  publish();

  const camera = new PerspectiveCamera(60, 1, 0.1, 300);
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
  const observer =
    typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(() => resize());
  observer?.observe(host);

  const applyCamera = () => {
    const pose = cameraPose(
      state.mode,
      state,
      state.mode === 'first' ? state.turret : 0
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
          state.turret + command.turret * 1.8 * delta
        );
        playerRig.turret.rotation.y = state.turret;
      }

      combat = tickCooldown(combat, delta);
      if (combat.cooldownMs === 0 && input.consumeFireRequest()) {
        const muzzle = muzzlePoint(
          { x: state.position.x, z: state.position.z },
          state.heading,
          state.turret,
          layout.player.barrelLength
        );
        combat = spawnShell(combat, muzzle, state.heading + state.turret);
        publish();
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
