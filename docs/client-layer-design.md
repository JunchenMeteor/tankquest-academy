# 客户端层设计

## 1. 客户端层是什么

客户端层负责隔离游戏逻辑和运行平台。它封装 API、资源加载、存档、平台能力、埋点和认证。

游戏逻辑不直接依赖：

```text
fetch
localStorage
window.navigator
indexedDB
native bridge
```

而是通过客户端层访问。

## 2. 核心客户端

```text
ApiClient
AssetClient
SaveClient
AuthClient
TelemetryClient
PlatformClient
```

## 3. ApiClient

负责和主后端通信。

```text
getLevel(levelId)
startSession(payload)
submitAnswer(sessionId, payload)
submitEvent(sessionId, payload)
finishSession(sessionId, payload)
getChildProgress(childId)
upgradeTank(payload)
```

## 4. AssetClient

负责资源清单、下载、缓存和加载失败兜底。

```text
getAssetManifest(levelId)
preloadAssets(assetIds)
resolveAssetUrl(assetId)
getFallbackAsset(type)
```

后续 Web、Windows、Mobile 可以替换不同实现。

## 5. SaveClient

负责本地临时存档和弱网恢复。

```text
saveSessionDraft(session)
loadSessionDraft(sessionId)
markSessionPendingSync(sessionId)
syncPendingSessions()
clearSessionDraft(sessionId)
```

第一版 Web 可用 IndexedDB/localStorage。后续 App 可替换为本地文件或 SQLite。

## 6. PlatformClient

负责识别运行平台。

```text
getPlatform(): web | windows | android | ios
isTouchDevice()
supportsGamepad()
supportsFileCache()
supportsNativeNotification()
```

## 7. TelemetryClient

负责关键事件上报。上报失败不影响游戏。

```text
trackLevelStart()
trackLevelComplete()
trackQuestionAnswer()
trackTankUpgrade()
trackError()
```

## 8. 多端迁移原则

后续从 Web 打包到 Windows/手机时，应优先替换客户端层实现，而不是重写游戏业务。

```text
Web: BrowserClientLayer
Tauri: TauriClientLayer
Capacitor: MobileClientLayer
Unity/Godot: NativeGameClientLayer
```
