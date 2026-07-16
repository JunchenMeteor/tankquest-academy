# 多端打包规范

## 1. 路线

```text
Web MVP
-> PWA
-> Tauri Windows
-> Capacitor Android/iOS
-> 必要时 Unity/Godot
```

## 2. Web

Web 版本是主版本。所有新功能先在 Web 验证。

## 3. PWA

PWA 支持：

- 安装到桌面。
- 基础离线缓存。
- 资源预加载。

## 4. Windows App

Phase 5 使用 Tauri 2 实现 Windows 技术预览，具体边界以 `phase-five-scope.md` 为准。Web 仍是主版本，Windows 壳复用同一份 React、Phaser 和客户端契约，不复制业务规则。

注意：

- 显式 `PlatformClient` 和独立 Tauri adapter。
- 最小 capability、CSP 和可配置 API origin。
- Service Worker 与 Windows WebView 隔离。
- 离线、配置和 bridge 失败时安全降级。
- WebView 兼容性。
- Windows runner 构建和启动烟测。

技术预览不包含代码签名、应用商店发布、自动更新、本地权威存档或正式离线对局。文件缓存和崩溃诊断只有在隐私边界和真实需求明确后再增加。

## 5. Mobile App

推荐 Capacitor。

注意：

- 触控 UI。
- 横屏适配。
- 音频权限。
- 本地缓存。
- 应用商店儿童政策。

## 6. 客户端层适配

多端差异必须通过客户端层处理：

```text
PlatformClient
SaveClient
AssetClient
TelemetryClient
```

游戏逻辑不能直接判断平台细节。
