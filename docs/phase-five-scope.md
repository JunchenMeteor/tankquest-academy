# Phase 5 Windows 技术预览范围

> 状态：2026-07-17 工程实施完成，版本 v0.5.0。Phase 5 只验证现有 Web 产品通过 Tauri 在 Windows 上的可构建、可启动和可降级能力，不改变战斗、学习、AI 或结算规则。逐项证据见 `phase-five-acceptance.md`。

## 1. 技术决策

Phase 5 使用 Tauri 2 包装现有 React、Phaser 4.2.1 和 API 客户端，不创建第二套游戏实现：

```text
共享 Web UI、Phaser 和客户端契约
-> BrowserPlatformClient 继续服务浏览器和 PWA
-> TauriPlatformClient 隔离 Windows WebView 与原生能力
-> Tauri Windows 壳加载同一份生产 Web 构建
-> 现有 HTTPS API、AI 服务和 PostgreSQL 继续提供权威数据
```

Web 仍是主版本，所有产品功能先在 Web 验证。Windows 技术预览只增加平台适配、原生壳和构建证据；不得复制答案判定、奖励、升级、难度、AI 安全或战斗数值。

## 2. 必须实现

### 2.1 显式平台边界

- `PlatformClient` 提供运行平台和能力声明，并保留在线状态与 Service Worker 边界。
- 浏览器和 Tauri 使用独立 adapter；React、Phaser 和领域逻辑不直接判断 Tauri 或 Windows 细节。
- Tauri WebView 不注册 PWA Service Worker；浏览器 PWA 行为保持不变。
- 既有浏览器 API 直连债务分批迁移，不在一个 PR 中重写全部主题、语言、存储和输入层。

### 2.2 Windows Tauri 壳

- 新增独立 Tauri workspace，锁定 Tauri、Rust 和前端依赖版本。
- 开发与打包都复用现有 Web 入口和静态构建，不复制 UI 或游戏源码。
- 只开放启动所需的最小 capability、CSP 和远程 API origin。
- 应用元数据、窗口尺寸、图标和包标识使用 TankQuest 统一命名。

### 2.3 启动配置与失败降级

- API 地址来自构建配置，不硬编码生产凭据或儿童数据。
- 离线、API 不可达、配置无效或原生 bridge 不可用时显示可恢复状态，不白屏、不伪造对局结果。
- Windows 技术预览不提供离线正式对局、离线奖励、离线升级或后台同步。
- 崩溃与诊断信息不得包含题目答案、儿童资料、会话令牌或家长数据。

### 2.4 Windows 构建与烟测

- GitHub Actions 在受支持的 Windows runner 上验证 Rust、Tauri 和 Web 生产构建。
- 产物只用于技术预览和内部验证；构建失败必须阻止 Phase 5 验收。
- 自动化至少验证应用配置、平台选择、静态资源解析和启动失败降级。
- README 或发布文档提供 Windows 开发、构建和已知限制说明。

## 3. 权威边界

后端继续独立决定：

```text
正式关卡、题目和答案
奖励、升级、持久化和难度
坦克与敌人正式属性
对局事件、结算和学习记录
AI 输出安全校验和儿童可见内容发布
```

Tauri 壳和平台 adapter 只能声明能力、承载 Web 构建并转发经过现有客户端层的请求，不能添加本地权威规则。

## 4. 明确不做

- 完整 low-poly 3D、自由镜头、3D 物理或更换游戏引擎。
- 多人联机、实时同步、账号匹配或排行榜。
- Android/iOS、Capacitor、应用商店提交或儿童商店合规认证。
- Windows 代码签名、公开安装器分发、自动更新或增量补丁。
- 原生本地数据库、完全离线正式对局或本地奖励结算。
- 重写现有 Web UI、Phaser 战斗、PWA 或服务器 Docker 拓扑。
- 收集新的儿童个人数据或把敏感诊断上传到第三方。

完整 3D 和多人玩法在 Phase 6+ 分别评估，不与 Windows 包装绑定。

## 5. 验收标准

- Web 构建和 PWA 行为无回归，浏览器继续使用 `BrowserPlatformClient`。
- Windows 壳选择 `TauriPlatformClient`，且不会注册 Service Worker。
- Windows runner 能从干净环境生成技术预览构建产物。
- 技术预览可以启动、加载现有首页并连接配置的 API。
- API 不可达、离线和 bridge 不可用时有明确降级，不进入正式对局或产生奖励。
- Tauri capability、CSP 和 API origin 采用最小允许范围，仓库和产物不含密钥。
- 现有格式、资源、PWA、数据库、lint、类型、单元、E2E、Web 构建和三套容器检查继续通过。
- preview/release 的四容器拓扑、域名和数据路径不因 Windows 壳改变。

## 6. PR 顺序

1. Phase 5 范围、技术决策和验收标准。
2. 显式 `PlatformClient` 契约、Browser adapter 和启动选择点。
3. Tauri 2 Windows 壳、最小 capability、CSP 和统一应用元数据。
4. Tauri adapter、运行时配置、Service Worker 隔离和启动失败降级。
5. Windows 构建、平台烟测和受保护 CI 门禁。
6. Phase 5 验收证据、v0.5.0、preview/release 和技术预览构建验证。

每个 PR 必须从最新 `main` 创建，等待 `Verify` 和 API/Web/AI 三套容器检查通过后 squash merge；不得直接 push `main` 或 `release`。
