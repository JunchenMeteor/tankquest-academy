# Phase 5 工程验收记录

验收日期：2026-07-17

## 1. 结论

Phase 5 工程范围通过验收，可以发布 v0.5.0。现有 Web 产品已经通过 Tauri 2 形成 Windows 技术预览，同时保持 Web/PWA 主版本和服务端权威规则不变：

```text
共享 React、Phaser 4.2.1 和客户端契约
-> BrowserPlatformClient 服务 Web/PWA
-> TauriPlatformClient 服务 Windows WebView
-> 三套构建配置绑定独立 API origin 和最小 CSP
-> 启动健康门禁在配置、bridge、网络或 API 失败时安全关闭
-> Windows CI 生成未签名 NSIS 安装器并验证主窗口响应
```

本结论覆盖工程实现、GitHub hosted Windows runner 和自动化失败降级。公开安装器分发、代码签名、自动更新、Windows 商店、真实家庭设备矩阵和正式离线对局不在本阶段结论内。

## 2. 交付证据

| 范围 | 状态 | 实现与证据 |
| --- | --- | --- |
| 范围与技术决策 | 通过 | PR #133；冻结 Web-first、Tauri 2、Windows 技术预览和 Phase 6+ 边界 |
| 显式平台边界 | 通过 | PR #135；PlatformClient、Browser adapter、工厂选择点和回归测试 |
| Windows 原生壳 | 通过 | PR #137；Rust 1.97.0、Tauri 2.11.5、最小 capability/CSP、统一元数据和 NSIS 配置 |
| 配置与安全降级 | 通过 | PR #139；三环境 API/CSP、Tauri adapter、Service Worker 隔离、健康预检和可执行重试 |
| Windows 构建与烟测 | 通过 | PR #141；Windows runner、release Clippy、NSIS 构建、响应窗口烟测、Rust/npm 缓存和受保护 Verify 汇总 |
| 验收与发布 | 发布门禁 | 本 PR；v0.5.0 版本、文档和发布说明进入 accepted main，最终状态由 preview/release Actions 和 GitHub Release 裁决 |

## 3. 验收标准

| 验收项 | 状态 | 验证方式 |
| --- | --- | --- |
| Web/PWA 行为无回归 | 通过 | Browser adapter 保持原能力；Web 构建、PWA 策略、离线业务拒绝和 7 项 Playwright 流程继续通过 |
| Windows 选择独立 adapter | 通过 | Web/Tauri 四象限测试覆盖正常与 mismatch；Tauri adapter 不调用 Service Worker 注册 |
| 三环境配置隔离 | 通过 | development、preview、release 的 Vite mode、API origin 和 `connect-src` 精确匹配且互不串用 |
| 启动失败安全关闭 | 通过 | 配置、bridge、runtime mismatch、离线、超时和 API 异常均不进入游戏树，不创建会话、奖励或升级 |
| Windows 干净构建 | 通过 | `windows-latest` 固定 Rust 1.97.0，执行配置验证、fmt、release Clippy 和未签名 preview NSIS 构建 |
| Windows 启动烟测 | 通过 | 构建后的 exe 达到 idle message loop，创建主窗口且 `Responding=true`，随后由测试安全结束进程 |
| 产物和缓存边界 | 通过 | 安装器 artifact 为 2,274,328 bytes、上传 1 秒、保留 14 天；410,178,448 bytes Rust 编译缓存独立按 Cargo.lock 内容键复用，不作为部署 artifact |
| 服务端权威规则不变 | 通过 | 答案、奖励、升级、难度、战斗结算、学习记录和 AI 安全仍由既有后端裁决 |

## 4. 自动化门禁

v0.5.0 发布准备执行：

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

当前单元与契约测试为 API 80、Web 105、Shared 9、AI 53 项。受保护 `Verify` 汇总同时要求 Linux Core 和 Windows desktop 成功：Linux 在干净 PostgreSQL 上执行 migration、重复 seed 和 7 项 Playwright 流程；Windows 生成可启动 NSIS 技术预览。PR 还必须通过 API、Web、AI 三套容器检查。

PR #141 的首个完整 Windows 冷构建为 10 分 04 秒，其中配置、Web 资源、fmt、release Clippy、NSIS、11 秒窗口烟测和 1 秒 artifact 上传全部通过；后续相同 Cargo.lock 运行使用独立 Rust 缓存。

## 5. 发布验证

验收 PR 合并 `main` 后，`TankQuest Preview and Release` 必须先把相同提交部署到 preview，并通过首页、家长页、API/AI 健康、英中家长摘要、PWA 入口、Service Worker、资源 manifest、实际字节数和 SHA-256 等公开契约。

同一 accepted main 还必须在 Windows runner 重新生成 v0.5.0 preview 安装器并通过响应窗口烟测。随后 `TankQuest Release Manager` 通过独立受保护 PR 将 accepted `main` 精确树晋级到 `release`，等待生产部署和相同公开探针通过后才创建 GitHub Release v0.5.0。是否完成以对应 Actions 运行与 GitHub Release 为准，文档不预先替代运行证据。

服务器继续使用 `/data/projects/tankquest/<environment>` 下相互隔离的 preview/release Web、API、AI、PostgreSQL 四容器；Windows 技术预览不改变服务器端口、域名、Docker 根目录或数据路径。

## 6. 已知非阻塞项

- Windows 安装器未签名，系统可能显示未知发布者提示；不得作为面向儿童家庭的公开正式安装包宣传。
- 技术预览依赖在线 HTTPS API，不支持离线正式对局、离线奖励、离线升级、本地权威存档或后台同步。
- GitHub hosted runner 验证构建和启动，不替代真实 Windows 10/11 家庭设备、显卡、缩放、音频和长时间游戏测试。
- 当前没有自动更新、增量补丁、Windows 商店发布、崩溃上传或原生通知/文件缓存能力。
- 首次无缓存的 Rust/NSIS 构建较慢；Cargo.lock 未变化时使用内容键缓存，安装器 artifact 仍保持约 2.17 MiB。
- 完整 low-poly 3D、多人联机和 Android/iOS 分别留到 Phase 6+ 评估，不与本次 Windows 包装绑定。
- Prisma 6 的 seed 配置在 Prisma 7 前需迁移到独立配置文件。
