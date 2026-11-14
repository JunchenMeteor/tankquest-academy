# Player Aiming System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract player aiming from `battle-view.ts` into a per-battle, two-phase controller without changing aiming, firing, pointer, terrain, or rendering behavior.

**Architecture:** A factory creates one controller per battle. The controller owns only `aimPoint`, `gunPitch`, a raycaster, and reusable vectors; `RuntimeState.turret` and all Three.js resources remain with the existing view. Control runs before enemy/terrain updates, presentation runs afterward, and firing remains outside the controller.

**Tech Stack:** TypeScript, Three.js, Vitest, React, Vite, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-14-player-aiming-system-design.md`

## Global Constraints

- Preserve `createBattleView()` and `Battle3DHandle` exactly.
- Preserve 60 Hz fixed-step logic and the current frame order.
- No global singleton, service locator, new framework, or backend changes.
- No enemy AI, map, physics, Pointer Lock, or unrelated performance changes in this PR.
- Player fire depends only on ammo, cooldown, and fire request, never reticle alignment.
- Every code change follows TDD: watch the new test fail before implementing it.
- Issue/PR titles use the repository prefix rules; commit messages have no bracket prefix or tool attribution.

---

### Task 1: Build and test the two-phase player aim controller

**Files:**

- Create: `apps/web/src/game/three/player-aim-controller.ts`
- Create: `apps/web/src/game/three/player-aim-controller.test.ts`
- Reuse: `apps/web/src/game/three/battle-aim.ts`
- Reuse: `apps/web/src/game/three/tank-rig.ts`

**Interfaces:**

- Consumes: `aimAlignmentError`, `localAimPitch`, `muzzleAimYaw`, `projectGunSight`, `resolveAimPoint`, `rotateTowards`, `stepGunPitch`, `normaliseAngle`, `SHELL_RANGE`, `TankRig`, `DriveCommand`.
- Produces: `createPlayerAimController(options)`, `updateControl(frame)`, and `updatePresentation(frame)` used by `battle-view.ts`.

- [ ] **Step 1: Write the failing control and presentation tests**

Create tests using real Three.js objects. The rig must include an intrinsic muzzle yaw offset so the test fails if the controller reverts to logical turret heading instead of the real muzzle axis.

```ts
import { Group, PerspectiveCamera, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { createPlayerAimController } from './player-aim-controller.js';
import type { TankRig } from './tank-rig.js';

function rigWithOffset(): TankRig {
  const root = new Group();
  const turret = new Group();
  const gun = new Group();
  const muzzle = new Group();
  root.rotation.z = 0.1;
  gun.rotation.y = Math.PI / 2;
  muzzle.rotation.y = 0.01;
  muzzle.position.z = 4;
  root.add(turret);
  turret.add(gun);
  gun.add(muzzle);
  root.updateMatrixWorld(true);
  return {
    root,
    turret,
    gun,
    muzzle,
    wheels: [],
    idlers: [],
    sprockets: [],
    returnRollers: [],
    wheelAxis: 'x',
    wheelRadius: 0.38,
    trackTextures: [],
    trackLoops: [],
  };
}

describe('player aim controller', () => {
  it('converges the real muzzle axis and projects both reticles', () => {
    const rig = rigWithOffset();
    const camera = new PerspectiveCamera(60, 1, 0.1, 200);
    camera.position.set(0, 5, 10);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld(true);
    const controller = createPlayerAimController({
      getRig: () => rig,
      traverseSpeed: 10,
      elevationSpeed: 10,
    });
    const state = { position: { x: 0, y: 0, z: 0 }, heading: 0, turret: 0 };
    const pointer = { x: 50, y: 50, ready: true };
    const control = controller.updateControl({
      delta: 1,
      state,
      command: { forward: 0, turn: 0, turret: 0 },
      rightHeld: false,
      pointer,
      camera,
      camYaw: 0,
      bounds: { width: 100, height: 100 },
      targets: [],
    });
    rig.turret.rotation.y = control.turret;
    rig.gun.rotation.x = control.gunPitch;
    rig.root.updateMatrixWorld(true);
    const result = controller.updatePresentation({
      camera,
      pointer,
      guidedAim: true,
      bounds: { width: 100, height: 100 },
    });
    expect(result.aligned).toBe(true);
    expect(result.sight.x).toBeCloseTo(50);
    expect(result.sight.y).toBeCloseTo(50);
    expect(result.direction.length()).toBeCloseTo(1);
  });

  it('keeps the camera target on the non-guided path', () => {
    const controller = createPlayerAimController({
      getRig: rigWithOffset,
      traverseSpeed: 0.5,
      elevationSpeed: 1,
    });
    const result = controller.updateControl({
      delta: 0.2,
      state: { position: { x: 0, y: 0, z: 0 }, heading: 0, turret: 0 },
      command: { forward: 0, turn: 0, turret: 0 },
      rightHeld: true,
      pointer: { x: 50, y: 50, ready: false },
      camera: new PerspectiveCamera(),
      camYaw: 1,
      bounds: { width: 100, height: 100 },
      targets: [],
    });
    expect(result.turret).toBeCloseTo(0.1);
    expect(result.guidedAim).toBe(false);
    expect(result.aimOffset).toBeCloseTo(1);
  });
});
```

- [ ] **Step 2: Run the tests and confirm the missing factory fails**

Run: `npm test --workspace @tankquest/web -- --run src/game/three/player-aim-controller.test.ts`
Expected: FAIL because `createPlayerAimController` does not exist.

- [ ] **Step 3: Define the public controller contract**

Create `player-aim-controller.ts` with these exact types:

```ts
import { Raycaster, Vector2, Vector3 } from 'three';
import type { Camera, Object3D } from 'three';
import type { DriveCommand } from './battle-input.js';
import type { TankRig } from './tank-rig.js';

export interface AimPointer {
  x: number;
  y: number;
  ready: boolean;
}
export interface AimState {
  position: { x: number; y: number; z: number };
  heading: number;
  turret: number;
}
export interface AimControlFrame {
  delta: number;
  state: AimState;
  command: DriveCommand;
  rightHeld: boolean;
  pointer: AimPointer;
  camera: Camera;
  camYaw: number;
  bounds: { width: number; height: number };
  targets: Object3D[];
}
export interface AimPresentationFrame {
  camera: Camera;
  pointer: AimPointer;
  guidedAim: boolean;
  bounds: { width: number; height: number };
}
export interface PlayerAimControllerOptions {
  getRig: () => TankRig;
  traverseSpeed: number;
  elevationSpeed: number;
}
```

The controller returns `{ turret, gunPitch, guidedAim, aimOffset }` from `updateControl` and `{ muzzle, direction, sight, aligned }` from `updatePresentation`. `sight` is in CSS pixels and `muzzle`/`direction` are new vectors owned by the caller.

- [ ] **Step 4: Implement the control phase**

Use a per-instance `aimPoint` and `gunPitch`. Keep this exact behavior:

```ts
const rig = options.getRig();
const guidedAim =
  !frame.rightHeld && frame.command.turret === 0 && frame.pointer.ready;
let targetWorld: number | null =
  frame.rightHeld || frame.command.turret !== 0 ? null : frame.camYaw;

if (guidedAim) {
  const ndc = new Vector2(
    (frame.pointer.x / Math.max(1, frame.bounds.width)) * 2 - 1,
    -(frame.pointer.y / Math.max(1, frame.bounds.height)) * 2 + 1
  );
  raycaster.setFromCamera(ndc, frame.camera);
  aimPoint.copy(resolveAimPoint(raycaster.ray, frame.targets, SHELL_RANGE * 2));
  targetWorld = muzzleAimYaw(
    rig.muzzle,
    aimPoint,
    frame.state.heading,
    frame.state.turret
  );
  gunPitch = stepGunPitch(
    gunPitch,
    localAimPitch(rig.gun, aimPoint, rig.muzzle),
    elevationSpeed * frame.delta
  );
}

const turret =
  targetWorld === null
    ? frame.state.turret
    : rotateTowards(
        frame.state.turret,
        normaliseAngle(targetWorld - frame.state.heading),
        traverseSpeed * frame.delta
      );
const aimOffset =
  targetWorld === null
    ? null
    : normaliseAngle(targetWorld - (frame.state.heading + frame.state.turret));
return { turret, gunPitch, guidedAim, aimOffset };
```

Apply no rig or runtime-state mutation in this method.

- [ ] **Step 5: Implement the presentation phase**

Read the final world transforms after terrain synchronization:

```ts
const rig = options.getRig();
const muzzle = rig.muzzle.getWorldPosition(new Vector3());
const direction = rig.muzzle.getWorldDirection(new Vector3());
const projected = projectGunSight(
  muzzle,
  direction,
  frame.pointer.ready ? muzzle.distanceTo(aimPoint) : SHELL_RANGE,
  frame.camera
);
const aligned =
  !frame.guidedAim ||
  aimAlignmentError(muzzle, direction, aimPoint) <= FIRE_AIM_TOLERANCE;
return {
  muzzle,
  direction,
  aligned,
  sight: {
    x: ((projected.x + 1) / 2) * frame.bounds.width,
    y: ((1 - projected.y) / 2) * frame.bounds.height,
  },
};
```

Export `createPlayerAimController(options)` as a factory returning `{ updateControl, updatePresentation }`. Do not export a singleton.

- [ ] **Step 6: Run the controller tests and full aiming tests**

Run: `npm test --workspace @tankquest/web -- --run src/game/three/player-aim-controller.test.ts src/game/three/battle-aim.test.ts src/game/three/battle-combat.test.ts`
Expected: all tests pass.

- [ ] **Step 7: Commit the independently tested controller**

```bash
git add apps/web/src/game/three/player-aim-controller.ts apps/web/src/game/three/player-aim-controller.test.ts
git commit -m "Add a two-phase player aim controller"
```

---

### Task 2: Wire the controller into the battle view without behavior changes

**Files:**

- Modify: `apps/web/src/game/three/battle-view.ts`
- Modify: `apps/web/src/game/three/player-aim-controller.test.ts`
- Modify: `docs/3d-battle/README.md`

**Interfaces:**

- Consumes: `createPlayerAimController(options)`, `updateControl(frame)`, `updatePresentation(frame)` from Task 1.
- Produces: the same `createBattleView()` and `Battle3DHandle` API as before.

- [ ] **Step 1: Add a failing integration regression for independent instance state**

Add a test proving two controllers do not share `gunPitch` or `aimPoint`:

```ts
it('keeps independent aim state per battle instance', () => {
  const first = createPlayerAimController({
    getRig: rigWithOffset,
    traverseSpeed: 1,
    elevationSpeed: 0,
  });
  const second = createPlayerAimController({
    getRig: rigWithOffset,
    traverseSpeed: 1,
    elevationSpeed: 1,
  });
  const frame = {
    delta: 0.1,
    state: { position: { x: 0, y: 0, z: 0 }, heading: 0, turret: 0 },
    command: { forward: 0, turn: 0, turret: 0 },
    rightHeld: false,
    pointer: { x: 50, y: 50, ready: true },
    camera: new PerspectiveCamera(),
    camYaw: 0,
    bounds: { width: 100, height: 100 },
    targets: [],
  };
  const firstResult = first.updateControl(frame);
  const secondResult = second.updateControl(frame);
  expect(firstResult.gunPitch).not.toBe(secondResult.gunPitch);
});
```

Run: `npm test --workspace @tankquest/web -- --run src/game/three/player-aim-controller.test.ts`
Expected: FAIL if instance state is shared; if it passes immediately, keep it as a guard and record that the factory already satisfies the requirement rather than changing code to force a failure.

- [ ] **Step 2: Replace only the player control block in `battle-view.ts`**

Create the controller after `playerRig` exists:

```ts
const aimController = createPlayerAimController({
  getRig: () => playerRig,
  traverseSpeed,
  elevationSpeed,
});
```

Replace the current guided-aim/turret block with:

```ts
const control = aimController.updateControl({
  delta,
  state,
  command,
  rightHeld,
  pointer: aim,
  camera,
  camYaw,
  bounds: canvas.getBoundingClientRect(),
  targets: [...enemyRoots.values(), ground],
});
state.turret = control.turret;
gunPitch = control.gunPitch;
playerRig.turret.rotation.y = state.turret;
if (playerRig.gun.userData.pitchAxis === 'x') {
  playerRig.gun.rotation.x = gunPitch;
} else {
  playerRig.gun.rotation.z = -gunPitch;
}
if (control.aimOffset !== null) onAimOffset?.(control.aimOffset);
```

Do not change driving, enemy updates, ram handling, obstacle resolution, or ground poses.

- [ ] **Step 3: Replace only the player projection block**

After `applyTankGroundPose(playerRig.root, ...)`, call:

```ts
const presentation = aimController.updatePresentation({
  camera,
  pointer: aim,
  guidedAim: control.guidedAim,
  bounds: canvas.getBoundingClientRect(),
});
const { muzzle, direction, sight, aligned: reticleAligned } = presentation;
```

Keep the existing `onReticle` and `onPointerReticle` callbacks and all reload/fire code. `canFire`, `canPlayerFire`, shell scattering, and `aimPitch(muzzle, scattered)` must remain outside the controller and unchanged.

- [ ] **Step 4: Run focused integration tests and typecheck**

Run: `npm test --workspace @tankquest/web -- --run src/game/three/player-aim-controller.test.ts src/game/three/battle-aim.test.ts src/game/three/battle-combat.test.ts src/game/three/battle-pointer-input.test.ts src/game/three/battle-view-terrain.test.ts && npx tsc --noEmit -p apps/web`
Expected: all tests and typecheck pass, with no unused `gunPitch` or aim-controller variables.

- [ ] **Step 5: Update the architecture documentation**

Add `player-aim-controller.ts` to the `docs/3d-battle/README.md` code map. Document that it owns only per-battle aim state and runs control before enemy/terrain updates and presentation afterward. Do not claim a broader battle-loop refactor is complete.

- [ ] **Step 6: Run the complete quality gate**

Run in order:

```bash
npx prettier --check .
npm run lint
npm run typecheck
npm test
npm run build
node scripts/verify-web-performance.mjs
```

Expected: all checks pass; Web test count is at least the previous 317 plus the new controller tests; shell/game gzip budgets remain within 130 KB/560 KB.

- [ ] **Step 7: Commit the integration**

```bash
git add apps/web/src/game/three/battle-view.ts apps/web/src/game/three/player-aim-controller.test.ts docs/3d-battle/README.md
git commit -m "Extract player aiming from the battle view"
```

---

### Task 3: Verify the release candidate and merge safely

**Files:**

- Modify only if evidence requires correction: `apps/web/src/game/three/player-aim-controller.ts`
- Modify only if evidence requires correction: `apps/web/src/game/three/battle-view.ts`

**Interfaces:**

- Consumes: the integrated controller from Tasks 1–2.
- Produces: verified Preview/production behavior and a mergeable PR; no new feature scope.

- [ ] **Step 1: Run local real-browser aiming checks**

Use `?model=glb&quality=high` and hardware acceleration where available. Verify:

- Passive targets remain on local terrain.
- Normal targets converge to 0 px after settling, both at spawn and on a slope.
- A deliberately misaligned click increments shots and consumes ammo.
- Extreme gun-limit targets may remain unaligned but still fire.
- Pointer Lock, right-drag look, and Esc input cleanup still work.

Record numeric reticle error and screenshots; do not rely on visual judgment alone.

- [ ] **Step 2: Compare performance with the baseline**

Reuse the RTX 2070 sampling method in `Codex/TankQuestAssets/PerformanceBaseline-20261113/run-baseline.cjs`. Compare average FPS, P95 frame time, long tasks, heap trend, and quality tier against `baseline-r0960.json`. Investigate any persistent new long task or quality downgrade before merging.

- [ ] **Step 3: Run CI and merge only when all required checks pass**

Push the branch and create a `[Refactor]` PR that closes its implementation issue. Require Verify, Core, Windows desktop, and API/AI/Web container checks. Squash merge only after all are green.

- [ ] **Step 4: Promote the exact main tree to release and deploy both environments**

Create the release PR with `git merge -s ours origin/release`, verify `git diff --exit-code origin/main`, then deploy one new image tag to Preview and production. Cancel duplicate automatic deployment runs before manual deployment. Keep the previous image as the verified rollback.

- [ ] **Step 5: Repeat two adversarial rounds in each environment**

Round 1: spawn targets, pointer input, misaligned fire, and target terrain. Round 2: slope driving, turret/elevation convergence, extreme targets, and continuous firing. Check build hash and `/api/health` before and after. Report actual measurements and any residual limitation; do not claim a broader battle-loop, map, or physics refactor is complete.
