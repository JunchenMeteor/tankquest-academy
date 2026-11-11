# 战斗鼠标锁定与输入清理实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 消除浏览器边缘对瞄准和视角操作的限制，并保证任何退出路径都不会卡住开火或右键。

**Architecture:** 新增独立输入绑定模块，集中管理 Pointer Lock、Pointer Capture、虚拟准心和所有监听生命周期；Three.js 战斗逻辑只接收瞄准、视角和开火回调，React 负责锁定入口及答题时释放。

**Tech Stack:** TypeScript、React、Three.js、Pointer Lock API、Pointer Capture API、Vitest、Playwright。

**Spec:** `docs/superpowers/specs/2026-11-11-pointer-lock-input-design.md`

## Global Constraints

- 不新增依赖，不强制全屏，不改变触控、键盘驾驶、双准心和炮管跟随规则。
- 进入锁定的点击不得开火；恢复锁定必须来自明确用户手势。
- Web 测试不得少于 285 项，skipped 必须为 0；不得 mock 掉被测输入状态机本身。
- 从最新 main 创建 `dev/fix/battle-pointer-lock`，Issue/PR 用 `[Fix]`，commit 不加前缀。

## Review Focus

- 锁定前点击与锁定后点击必须区分，由 Task 1 的首次点击测试覆盖。
- Esc、答题、结算和失焦必须释放所有输入，由 Task 2 的状态测试覆盖。
- Pointer Lock 不可用或请求被拒绝必须保留可玩的降级，由 Task 1 的异常测试覆盖。
- 反复挂载不得累积全局监听，由 Task 2 的 dispose 测试覆盖。
- 虚拟准心不得因超大 movement 或非法数值飞出画布，由 Task 1 的边界测试覆盖。

---

### Task 1: 独立指针输入绑定与虚拟准心

**Files:**

- Create: `apps/web/src/game/three/battle-pointer-input.ts`
- Create: `apps/web/src/game/three/battle-pointer-input.test.ts`

**Interfaces:**

- Produces: `advanceVirtualAim(current, movement, bounds)`；`bindBattlePointerInput(canvas, callbacks)` 返回 `{ requestLock, release, dispose, isLocked }`。

- [ ] **Step 1: 写失败测试**
      断言虚拟准心按 movementX/Y 移动并夹在画布内；首次锁定不射击、锁定后左键射击、右键只控制视角；请求拒绝时绝对坐标和 Pointer Capture 仍可操作。
- [ ] **Step 2: 运行测试确认失败**
      Run: `npm test --workspace @tankquest/web -- --run src/game/three/battle-pointer-input.test.ts`
- [ ] **Step 3: 实现独立绑定模块**
      集中注册 pointerdown/move/up/cancel、lostpointercapture、pointerlockchange/error 和 contextmenu；锁定模式使用相对位移，非锁定模式使用 client 坐标；所有监听保存可移除引用。
- [ ] **Step 4: 运行测试确认通过**
      同一测试 PASS，包含 API 缺失和 Promise 拒绝路径。
- [ ] **Step 5: Commit**
      `git commit -m "Add pointer lock input controller"`。

### Task 2: 战斗集成与完整清理

**Files:**

- Modify: `apps/web/src/game/three/battle-view.ts`
- Modify: `apps/web/src/game/three/Battle3DCanvas.tsx`
- Create: `apps/web/src/game/three/Battle3DCanvas.test.tsx`
- Modify: `apps/web/src/styles.css`

**Interfaces:**

- Consumes: Task 1 的绑定返回值；`Battle3DHandle` 新增 `requestPointerLock()` 和 `releasePointerLock()`。

- [ ] **Step 1: 写失败测试**
      覆盖锁定按钮、Esc、答题释放、重新点击恢复、blur/visibilitychange 清理右键与开火、dispose 后全局监听不再触发；键盘失焦也释放。
- [ ] **Step 2: 运行相关测试确认失败**
      Run: `npm test --workspace @tankquest/web -- --run src/game/three/battle-pointer-input.test.ts src/game/three/battle-input.test.ts`
- [ ] **Step 3: 接入战斗与 React**
      用新绑定替换 battle-view 内现有指针监听；提供显式锁定按钮和 Esc 提示，答题/结算时释放，销毁时调用 dispose 并 `resetSource('pointer')`。非锁定右键使用 Pointer Capture。
- [ ] **Step 4: 运行相关测试确认通过**
      同一测试 PASS，旧 battle-input 测试全部保留。
- [ ] **Step 5: Commit**
      `git commit -m "Release battle input on every exit"`。

### Task 3: 文档、真实浏览器验证与发布

**Files:**

- Modify: `docs/3d-battle/README.md`
- Create: 任务目录中的 Playwright 验证脚本与结果，不放入仓库。

- [ ] **Step 1: 更新操作说明**
      写明锁定、Esc、答题、恢复和降级行为，删除“无 Pointer Lock”的旧注释/说明。
- [ ] **Step 2: 运行全部本地门禁**
      Run: `npx prettier --check .`、`npm run lint`、`npm run typecheck`、`npm test`、`npm run build`、`node scripts/verify-web-performance.mjs`，全部 PASS，Web 测试不少于 285 且 skipped=0。
- [ ] **Step 3: 真实浏览器对抗性验收**
      验证 Pointer Lock 元素、Esc、答题 UI、恢复、窗口外松开、失焦、反复挂载和非锁定降级；至少两轮，无卡开火、卡右键或首次点击误射。
- [ ] **Step 4: 提交 PR 并等待 CI**
      创建 Issue 和 `[Fix]` PR，Verify、Core、Windows desktop、API/AI/Web 容器全部通过后 squash 合并并更新 main。
- [ ] **Step 5: 与行走机构版本一起发布**
      将两个已合并修复晋级 release，使用同一新镜像部署 Preview/生产，核对构建号、健康接口、公网契约，并在两个环境重复关键输入与轮轨验收。
