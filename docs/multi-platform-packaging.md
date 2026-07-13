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

推荐 Tauri。

注意：

- 本地文件缓存。
- 自动更新。
- 崩溃日志。
- WebView 兼容性。

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
