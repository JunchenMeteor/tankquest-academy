# 前端技术选型

## 1. 选型目标

前端需要支持网页优先的坦克学习游戏，并为后续 Windows App、移动 App、2.5D/3D 演进保留接口。

目标：

- 快速做出可玩的 Web MVP。
- 游戏逻辑、UI、客户端能力分层。
- 支持多主题、多语言、多端打包。
- 避免组件里硬编码题库、关卡、坦克参数和奖励规则。

## 2. 第一阶段推荐

```text
Language: TypeScript
Game engine: Phaser 4.2.1
UI framework: React 或 Vue
Build tool: Vite
State: Zustand/Pinia
API client: fetch/axios + typed DTO
Testing: Vitest + Playwright
```

如果后续使用 Three.js：

```text
3D preview: Three.js
React stack: React Three Fiber
Vue stack: TresJS
```

## 3. 多端路线

```text
Phase 1: Web MVP
Phase 2: Web + PWA
Phase 3: Tauri 打包 Windows
Phase 4: Capacitor 打包 Android/iOS
Phase 5: 如果 3D 重度化，再评估 Unity/Godot
```

## 4. 不建议第一版做的事

- 直接上完整 3D 写实坦克。
- 一开始做多人实时对战。
- 把所有游戏逻辑写进一个 Scene 文件。
- 在前端硬编码题库和奖励。
- 直接依赖浏览器 API，而不经过客户端层封装。

## 5. 推荐结论

第一版推荐：

```text
Vite + TypeScript + Phaser 4.2.1 + React/Vue + typed API client
```

后续桌面和移动端优先复用 Web 代码：

```text
Windows: Tauri
Mobile: Capacitor
```
