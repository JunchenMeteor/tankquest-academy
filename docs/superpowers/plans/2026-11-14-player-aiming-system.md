# 玩家瞄准系统实施计划

> **给执行 agent：**必须使用 `superpowers:executing-plans` 按任务逐项实施，并用复选框记录进度。

**目标：**把玩家瞄准从 `battle-view.ts` 拆成每局独立的两阶段控制器，不改变瞄准、开火、指针、地形或渲染行为。

**架构：**工厂在每局战斗创建一个控制器。控制器只持有 `aimPoint`、`gunPitch`、射线检测器和可复用向量；`RuntimeState.turret` 与 Three.js 资源仍由现有视图管理。控制阶段位于敌人和地形更新之前，投影阶段位于其后，开火仍由控制器外部负责。

**技术栈：**TypeScript、Three.js、Vitest、React、Vite、Playwright。

**设计文档：**`docs/superpowers/specs/2026-11-14-player-aiming-system-design.md`

## 全局约束

- 完整保留 `createBattleView()` 和 `Battle3DHandle`。
- 保留 60 Hz 固定步进和现有帧顺序。
- 禁止全局单例、服务定位器、新框架和后端改动。
- 本 PR 不修改敌人 AI、地图、物理、Pointer Lock 或无关性能逻辑。
- 玩家开火只受弹药、冷却和开火请求约束，不受准心对齐约束。
- 所有代码改动遵循 TDD：先看到新增测试失败，再实现功能。
- Issue/PR 标题遵守仓库前缀规范；提交信息不加方括号前缀或工具署名。

---

### 任务 1：建立并验证两阶段玩家瞄准控制器

**文件：**

- 新建：`apps/web/src/game/three/player-aim-controller.ts`
- 新建：`apps/web/src/game/three/player-aim-controller.test.ts`
- 复用：`apps/web/src/game/three/battle-aim.ts`
- 复用：`apps/web/src/game/three/tank-rig.ts`

**接口：**

- 输入：`aimAlignmentError`、`localAimPitch`、`muzzleAimYaw`、`projectGunSight`、`resolveAimPoint`、`rotateTowards`、`stepGunPitch`、`normaliseAngle`、`SHELL_RANGE`、`TankRig`、`DriveCommand`。
- 输出：供 `battle-view.ts` 使用的 `createPlayerAimController(options)`、`updateControl(frame)`、`updatePresentation(frame)`。

- [ ] **步骤 1：先写控制与投影失败测试**

使用真实 Three.js 对象。测试 rig 必须带固有炮口水平偏移，防止实现退回逻辑炮塔朝向而不是真实炮口轴向。

```ts
import { Group, PerspectiveCamera } from 'three';
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
    const control = controller.updateControl({
      delta: 1,
      state: { position: { x: 0, y: 0, z: 0 }, heading: 0, turret: 0 },
      command: { forward: 0, turn: 0, turret: 0 },
      rightHeld: false,
      pointer: { x: 50, y: 50, ready: true },
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
      pointer: { x: 50, y: 50, ready: true },
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

- [ ] **步骤 2：运行测试并确认因工厂缺失而失败**

运行：`npm test --workspace @tankquest/web -- --run src/game/three/player-aim-controller.test.ts`

预期：失败，因为 `createPlayerAimController` 尚不存在。

- [ ] **步骤 3：定义控制器公开契约**

在 `player-aim-controller.ts` 中定义以下类型：

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

`updateControl` 返回 `{ turret, gunPitch, guidedAim, aimOffset }`；`updatePresentation` 返回 `{ muzzle, direction, sight, aligned }`。`sight` 使用 CSS 像素，调用方持有返回的 `muzzle` 和 `direction` 新向量。

- [ ] **步骤 4：实现控制阶段**

每个实例独立持有 `aimPoint` 和 `gunPitch`，并读取 `options.getRig()` 的最新 rig。保持现有行为：

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
    options.elevationSpeed * frame.delta
  );
}

const turret =
  targetWorld === null
    ? frame.state.turret
    : rotateTowards(
        frame.state.turret,
        normaliseAngle(targetWorld - frame.state.heading),
        options.traverseSpeed * frame.delta
      );
const aimOffset =
  targetWorld === null
    ? null
    : normaliseAngle(targetWorld - (frame.state.heading + frame.state.turret));
return { turret, gunPitch, guidedAim, aimOffset };
```

此方法不得修改 rig 或运行时状态。

- [ ] **步骤 5：实现投影阶段**

在地形同步之后读取最终世界变换：

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

导出 `createPlayerAimController(options)`，返回 `{ updateControl, updatePresentation }`，不得导出单例。

- [ ] **步骤 6：运行控制器与瞄准测试**

运行：`npm test --workspace @tankquest/web -- --run src/game/three/player-aim-controller.test.ts src/game/three/battle-aim.test.ts src/game/three/battle-combat.test.ts`

预期：全部通过。

- [ ] **步骤 7：提交已独立验证的控制器**

```bash
git add apps/web/src/game/three/player-aim-controller.ts apps/web/src/game/three/player-aim-controller.test.ts
git commit -m "Add a two-phase player aim controller"
```

---

### 任务 2：接入主视图且保持行为不变

**文件：**

- 修改：`apps/web/src/game/three/battle-view.ts`
- 修改：`apps/web/src/game/three/player-aim-controller.test.ts`
- 修改：`docs/3d-battle/README.md`

**接口：**

- 输入：任务 1 的 `createPlayerAimController(options)`、`updateControl(frame)`、`updatePresentation(frame)`。
- 输出：与之前完全一致的 `createBattleView()` 和 `Battle3DHandle`。

- [ ] **步骤 1：增加实例状态独立的回归测试**

证明两个控制器不共享 `gunPitch` 或 `aimPoint`：

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

运行：`npm test --workspace @tankquest/web -- --run src/game/three/player-aim-controller.test.ts`

预期：若共享实例状态则失败；若工厂已满足约束则保留该守护测试，不为制造失败而改坏实现。

- [ ] **步骤 2：只替换主视图中的玩家控制代码**

在 `playerRig` 可访问的位置创建控制器，`getRig()` 必须始终读取最新变量，防止 GLB 替换后使用旧模型：

```ts
const aimController = createPlayerAimController({
  getRig: () => playerRig,
  traverseSpeed,
  elevationSpeed,
});
```

用以下调用替换现有引导瞄准和炮塔控制块：

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

不得修改驾驶、敌人、撞击、障碍处理或地形姿态。

- [ ] **步骤 3：只替换玩家投影代码**

在 `applyTankGroundPose(playerRig.root, ...)` 后调用：

```ts
const presentation = aimController.updatePresentation({
  camera,
  pointer: aim,
  guidedAim: control.guidedAim,
  bounds: canvas.getBoundingClientRect(),
});
const { muzzle, direction, sight, aligned: reticleAligned } = presentation;
```

保留现有 `onReticle`、`onPointerReticle`、装填和开火代码。`canFire`、`canPlayerFire`、散布以及 `aimPitch(muzzle, scattered)` 必须留在控制器外部且行为不变。

- [ ] **步骤 4：运行定向集成测试和类型检查**

运行：`npm test --workspace @tankquest/web -- --run src/game/three/player-aim-controller.test.ts src/game/three/battle-aim.test.ts src/game/three/battle-combat.test.ts src/game/three/battle-pointer-input.test.ts src/game/three/battle-view-terrain.test.ts && npx tsc --noEmit -p apps/web`

预期：全部通过，没有未使用的瞄准变量或类型错误。

- [ ] **步骤 5：更新架构文档**

把 `player-aim-controller.ts` 加入 `docs/3d-battle/README.md` 的代码索引，说明其只持有每局瞄准状态，并在敌人和地形更新前执行控制、之后执行投影。不得宣称整个主循环、地图或物理重构已经完成。

- [ ] **步骤 6：运行完整质量门禁**

依次运行：

```bash
npx prettier --check .
npm run lint
npm run typecheck
npm test
npm run build
node scripts/verify-web-performance.mjs
```

预期：全部通过；Web 测试数不少于原有 317 项加新增测试；shell/game 的 gzip 预算仍不超过 130 KB/560 KB。

- [ ] **步骤 7：提交集成改动**

```bash
git add apps/web/src/game/three/battle-view.ts apps/web/src/game/three/player-aim-controller.test.ts docs/3d-battle/README.md
git commit -m "Extract player aiming from the battle view"
```

---

### 任务 3：验证候选版本并安全合并发布

**文件：**

- 仅在证据要求修正时修改：`apps/web/src/game/three/player-aim-controller.ts`
- 仅在证据要求修正时修改：`apps/web/src/game/three/battle-view.ts`

**接口：**

- 输入：任务 1–2 集成的控制器。
- 输出：通过验证的 Preview/生产行为和可合并 PR，不增加新功能范围。

- [ ] **步骤 1：执行本地真实浏览器验收**

使用 `?model=glb&quality=high`，可用时使用硬件加速，验证：

- 被动靶位仍贴合各自地形。
- 出生地和坡地的普通目标稳定后双准心均为 0 px。
- 故意未重合点击时射击次数增加且弹药减少。
- 超过物理限位的目标可以不重合，但仍能开火。
- Pointer Lock、右键环视和 Esc 输入清理保持正常。

必须记录数值误差和截图，不能只凭画面主观判断。

- [ ] **步骤 2：与真实设备性能基线比较**

复用 `G:/开发测试/Codex/TankQuestAssets/PerformanceBaseline-20261113/run-baseline.cjs` 的采样方式，对比 `baseline-r0960.json` 中的平均 FPS、P95 帧时间、长任务、堆内存趋势和画质。若出现持续新增长任务或额外画质降级，合并前必须查明原因。

- [ ] **步骤 3：CI 全部通过后合并**

推送分支并创建 `[Refactor]` PR 关联实施 Issue。Verify、Core、Windows desktop、API/AI/Web 容器检查全部通过后，才能 squash merge。

- [ ] **步骤 4：将 main 的精确树晋级到 release 并部署双环境**

使用 `git merge -s ours origin/release` 创建发布 PR，确认 `git diff --exit-code origin/main`，再用同一个新镜像标签部署 Preview 和生产。手工部署前取消重复自动发布，保留上一版可用回滚镜像。

- [ ] **步骤 5：在每个环境执行两轮对抗验收**

第一轮：出生点目标、指针输入、未重合开火和靶位地形。第二轮：坡地驾驶、炮塔/俯仰收敛、极限目标和连续开火。前后都核对构建号与 `/api/health`，报告真实测量和剩余限制，不得扩大宣称整个主循环、地图或物理重构完成。
