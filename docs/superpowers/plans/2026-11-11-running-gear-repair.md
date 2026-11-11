# 坦克行走机构修复 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 GLB 与程序化坦克的轮轨结构合理，并让敌我车辆的轮子和履带按实际位移运动。

**Architecture:** 用纯函数负责轮组布局和履带路径，Three.js 节点只保存视觉结构与实际滚动半径。GLB 保留贴图履带，程序化模型使用路径履带；两套模型共用 `advanceRunningGear`。

**Tech Stack:** TypeScript、Three.js、Vitest、Blender、Playwright。

**Spec:** `docs/superpowers/specs/2026-11-11-running-gear-repair-design.md`

## Global Constraints

- 不引入物理引擎或新依赖，不改变战斗数值、炮塔、炮管和 PBR 材质契约。
- Web 测试不得少于 285 项，skipped 必须为 0；不得删除或放松既有断言来制造绿灯。
- 一个 PR 只包含行走机构；从最新 main 创建 `dev/fix/running-gear-structure`，Issue/PR 用 `[Fix]`，commit 不加前缀。

## Review Focus

- 极端小车长下负重轮数量不得变成负数或穿出前后端轮，由 Task 2 的布局边界测试覆盖。
- 缩放后轮轴必须保持在几何中心，由 Task 1 的世界坐标测试覆盖。
- 敌方倒车和碰撞后位移不得让轮子反向错误，由 Task 3 的方向测试覆盖。
- GLB 新增齿形和托带轮必须跟随正确节点，由 Task 3 的父子关系测试覆盖。
- 中低画质不得下载 GLB，由最终浏览器网络检查覆盖。

---

### Task 1: GLB 轮组几何与实际半径

**Files:**

- Modify: `apps/web/src/game/three/tank-asset.ts`
- Modify: `apps/web/src/game/three/tank-rig.ts`
- Test: `apps/web/src/game/three/tank-asset.test.ts`
- Test: `apps/web/src/game/three/tank-rig-asset.test.ts`

**Interfaces:**

- Produces: 每轮 `userData.rollingRadius: number`，供 Task 2 的统一推进函数使用。

- [ ] **Step 1: 写失败测试**
      覆盖诱导轮、负重轮、主动轮的缩放、各轮与履带下支内表面接触、相邻表面间隙大于 0、前后位置及滚动半径来自归一化几何；先固定当前 GLB 审计中的 30.54 外突和 6.10 重叠场景。
- [ ] **Step 2: 运行聚焦测试确认失败**
      Run: `npm test --workspace @tankquest/web -- --run src/game/three/tank-asset.test.ts src/game/three/tank-rig-asset.test.ts`
- [ ] **Step 3: 实现分轮布局和半径元数据**
      `normalise()` 按轮索引应用独立 scale/前后偏移及轮心补偿；建议起点为诱导轮 0.70、后移 8，负重轮 0.85，主动轮 0.90、后移 3，最终以履带射线审计为准微调。把实际归一化半径写入每个轮节点，禁止继续从统一 0.38 推算。
- [ ] **Step 4: 运行聚焦测试并执行 Blender 审计**
      同一测试必须 PASS；`audit_running_gear.py` 不得再报告端轮越界或相邻轮负间隙。
- [ ] **Step 5: Commit**
      `git add` 本任务文件后执行 `git commit -m "Correct imported running gear geometry"`。

### Task 2: 程序化轮轨布局与闭合履带

**Files:**

- Create: `apps/web/src/game/three/running-gear-layout.ts`
- Create: `apps/web/src/game/three/running-gear-layout.test.ts`
- Modify: `apps/web/src/game/three/tank-model.ts`
- Modify: `apps/web/src/game/three/tank-rig.ts`
- Test: `apps/web/src/game/three/tank-rig.test.ts`

**Interfaces:**

- Produces: `layoutRoadWheels(hullDepth, wheelRadius)` 返回负重轮数量、半径、位置和端轮位置；`TankRig.trackLoops` 保存每侧履带节点及闭合路径。

- [ ] **Step 1: 写失败测试**
      对 scout/medium/heavy 的 hullDepth 断言端轮在后主动轮、前诱导轮，负重轮为 2–3 对且全部相邻间隙非负；轮底与下段履带接触、托带轮与上段接触；履带节实际节距不小于节长 0.26。
- [ ] **Step 2: 运行聚焦测试确认失败**
      Run: `npm test --workspace @tankquest/web -- --run src/game/three/running-gear-layout.test.ts src/game/three/tank-rig.test.ts`
- [ ] **Step 3: 实现布局和路径**
      按履带直线段空间均布负重轮；后主动轮位于负 X、前诱导轮位于正 X。履带带应用 floor 高度，托带轮以轮顶接触上段内表面；按周长/节距生成节点，不再固定每侧 120 节。
- [ ] **Step 4: 让履带沿路径运动**
      `advanceRunningGear(rig, travelled)` 使用每轮 `rollingRadius`，并按周长取模更新程序化履带节点的位置与角度；静止不移动、倒车反向。
- [ ] **Step 5: 运行聚焦测试**
      同一测试 PASS，且既有滚动方向断言不退化。
- [ ] **Step 6: Commit**
      `git commit -m "Align procedural tracks and road wheels"`。

### Task 3: 关键结构与敌我动画

**Files:**

- Create: `apps/web/src/game/three/running-gear-parts.ts`
- Create: `apps/web/src/game/three/running-gear-parts.test.ts`
- Modify: `apps/web/src/game/three/tank-asset.ts`
- Modify: `apps/web/src/game/three/battle-view.ts`

**Interfaces:**

- Consumes: Task 1 的 `rollingRadius` 和 Task 2 的 `trackLoops`。
- Produces: 可随主动轮旋转的齿形、归属车体的托带轮/简化悬挂；敌方与玩家共用轮轨推进。

- [ ] **Step 1: 写失败测试**
      断言主动轮齿形跟随对应轮节点，托带轮和悬挂不跟随炮塔；敌方位移会调用相同轮轨推进，方向由实际位移与车头点积决定。
- [ ] **Step 2: 运行聚焦测试确认失败**
      Run: `npm test --workspace @tankquest/web -- --run src/game/three/running-gear-parts.test.ts src/game/three/tank-rig.test.ts`
- [ ] **Step 3: 添加简化结构并接通敌方动画**
      齿形使用轻量 Three.js 几何并继承轮材质；托带轮位于上下履带之间。敌方每次位置更新计算实际位移并调用 `advanceRunningGear`，不重复推进静止车辆。
- [ ] **Step 4: 运行聚焦测试**
      同一测试 PASS，确认炮塔旋转不带动车体行走部件。
- [ ] **Step 5: Commit**
      `git commit -m "Animate running gear on every tank"`。

### Task 4: 文档、全量验证与发布

**Files:**

- Modify: `docs/3d-battle/tank-model.md`
- Create: 任务目录中的 Blender/Playwright 审计脚本与结果，不放入仓库。

- [ ] **Step 1: 更新文档**
      记录两类模型结构、滚动半径来源、程序化履带路径及明确不包含的物理能力，删除旧的 0.82/0.85 固定描述。
- [ ] **Step 2: 运行全部本地门禁**
      Run: `npx prettier --check .`、`npm run lint`、`npm run typecheck`、`npm test`、`npm run build`、`node scripts/verify-web-performance.mjs`，全部 PASS，Web 测试不少于 285 且 skipped=0。
- [ ] **Step 3: 浏览器对抗性验收**
      用 SwiftShader 检查星盾、铁山、程序化模型的两侧视图、前进、后退、敌方行驶和中低画质网络请求；至少两轮，保存数值与截图证据。
- [ ] **Step 4: 提交 PR 并等待 CI**
      创建 Issue 和 `[Fix]` PR，Verify、Core、Windows desktop、API/AI/Web 容器全部通过后 squash 合并并更新 main。
