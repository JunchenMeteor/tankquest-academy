# Phase 4 工程验收记录

验收日期：2026-07-16

## 1. 结论

Phase 4 工程范围通过验收，可以发布 v0.4.0。Web 训练场已经在不改变后端权威规则和 Arcade Physics 战斗坐标的前提下，增加可降级的资源管线、2.5D 表现、统一触控输入和安全 PWA 应用壳：

```text
后端已发布关卡与资源元数据
-> AssetClient 校验 URL、依赖、大小、SHA-256 和实际字节
-> Phaser 4.2.1 绘制主题化 2.5D 地面、障碍和分层坦克
-> 统一游戏命令接收键鼠、指针和触控输入
-> Service Worker 只缓存静态应用壳，业务 API 始终直连网络
```

本结论覆盖工程实现和自动化验证。真实家庭可用性、长时间低端设备性能、应用商店包装、完整 3D 和多人玩法不在本阶段结论内。

## 2. 交付证据

| 范围 | 状态 | 实现与证据 |
| --- | --- | --- |
| 范围与技术决策 | 通过 | PR #109；固定 Phaser 4.2.1、2.5D 分层表现、Arcade Physics 和 PWA 边界 |
| 资源清单与客户端层 | 通过 | PR #111；数据库元数据、公开 manifest API、依赖闭包、SHA-256/字节校验和安全 fallback |
| 坦克识别度 | 通过 | PR #113；三辆玩家坦克和 scout/medium/heavy 敌人的分层轮廓，选择页与对局共用描述 |
| 主题 2.5D 地图 | 通过 | PR #115；training-base、forest-camp、snow-field 的等距地面、立体障碍和稳定深度层 |
| 桌面与触控输入 | 通过 | PR #117；键鼠和粗指针映射为同一游戏命令，移动、瞄准和开火不改战斗数值 |
| PWA 与性能预算 | 通过 | PR #119；保守 Service Worker、API 拒绝边界、离线业务禁用、版本化图标和 gzip 预算 |
| 验收与发布 | 发布门禁 | PR #121；v0.4.0 文档与公开部署契约进入 accepted main，最终状态由 preview/release Actions 和 GitHub Release 裁决 |

## 3. 验收标准

| 验收项 | 状态 | 验证方式 |
| --- | --- | --- |
| 资源只来自已发布关卡且契约可信 | 通过 | Repository/Service/Controller/Shared schema 测试覆盖发布状态、依赖缺失/循环、字段、hash 和大小 |
| 资源失败不阻断主闭环 | 通过 | AssetClient 覆盖 404、超时、无效 JSON、跨源 URL、hash/字节不符、超限和 fallback |
| 三种地图和坦克轮廓可区分 | 通过 | 描述解析、选择页 SVG、Phaser 绘制 spy、主题调色板和稳定深度测试 |
| 物理与权威规则不漂移 | 通过 | 既有移动、射击、碰撞、撞击、穿深、敌方炮弹、答案和结算回归测试保持通过 |
| 触控可完成对局输入 | 通过 | 统一输入控制器测试、移动端布局和 Playwright 触控开火流程 |
| 离线只提供安全应用壳 | 通过 | 可执行 Service Worker 行为校验确认 `/api`/`/api/**` 不调用缓存，离线开始、答题、结算、重玩和升级均禁用 |
| 性能和降级有硬门禁 | 通过 | Phaser 继续懒加载；shell 92,440 B、game 361,338 B、CSS 2,262 B gzip，视觉描述 2,027 B |
| 部署拓扑不扩张 | 通过 | 继续使用 Web、API、AI、PostgreSQL 四容器和独立 preview/release 数据路径 |

## 4. 自动化门禁

v0.4.0 发布准备执行：

```bash
npm run format:check
npm run assets:verify
npm run pwa:verify
npm run db:validate
npm run lint
npm run typecheck
npm test
npm run build
```

当前单元与契约测试为 API 80、Web 72、Shared 9、AI 53 项。受保护 `Verify` 另外在干净 PostgreSQL 上执行 migration、重复 seed 和 7 项 Playwright 流程；PR 还必须通过 API、Web、AI 三套容器检查。

## 5. 发布验证

验收 PR 合并 `main` 后，`TankQuest Preview and Release` 必须先把相同提交部署到 preview。公开部署探针验证：

```text
首页和 /parent 返回 HTML
/api/health 与 AI 依赖健康
英中家长摘要非空且本地化
/manifest.webmanifest 契约与三个版本化 PNG 图标
/sw.js 使用 no-cache, no-store, must-revalidate
/api/assets/manifest?levelId=level_addition_range
manifest 中每个资源的 URL、实际字节数和 SHA-256
```

preview 通过真实 Service Worker 离线重载后，只能打开应用壳且所有业务 API 失败关闭。随后 `TankQuest Release Manager` 通过独立受保护 PR 将 accepted `main` 精确树晋级到 `release`，等待生产部署和相同公开探针通过后才创建 GitHub Release v0.4.0。是否完成以对应 Actions 运行与 GitHub Release 为准，文档不预先替代运行证据。

服务器还需确认 preview/release 的 Web、API、AI、PostgreSQL 容器全部 healthy，镜像标签对应各自目标合并提交，运行目录保持在 `/data/projects/tankquest/<environment>`。

## 6. 已知非阻塞项

- Phaser 游戏 chunk 原始体积仍超过 Vite 500 kB 提示，但保持懒加载并通过 400 KiB gzip 硬预算；进一步拆包属于性能专项。
- PWA 只缓存应用壳和版本化静态资源，不支持离线正式对局、学习记录、奖励、升级或后台同步。
- 触控 E2E 覆盖开火主路径；多指并发、不同移动浏览器和长时间设备发热仍需真实设备矩阵。
- 2.5D 使用程序化轻量表现，不包含完整 low-poly 3D、自由镜头、3D 物理或原生客户端。
- 正式多家庭鉴权、真实儿童与家长试用仍是独立产品验证门槛。
- Prisma 6 的 seed 配置在 Prisma 7 前需迁移到独立配置文件。
