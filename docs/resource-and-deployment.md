# 资源与部署设计

## 1. 资源分类

```text
业务数据：数据库
资源元数据：数据库
资源文件本体：对象存储/CDN/静态资源服务
```

资源文件包括：

```text
.glb / .gltf    坦克模型、场景模型
.webp / .png    贴图、涂装、UI 图
.ogg / .mp3     音效、背景音乐
.json           地图配置、关卡资源配置
.bin            glTF 二进制数据
```

## 2. 资源元数据

```json
{
  "assetId": "tank_mountain_heavy_v1",
  "type": "model",
  "url": "https://cdn.example.com/models/tanks/mountain-heavy-v1.glb",
  "version": "1.0.0",
  "hash": "sha256_xxx",
  "size": 824000,
  "tags": ["tank", "heavy", "low-poly"]
}
```

## 3. 加载流程

```text
前端请求关卡
-> 后端返回关卡配置和资源清单
-> 前端检查本地缓存
-> 缺失资源从 CDN 下载
-> 校验 hash
-> 加载模型/贴图/音效/地图
-> 失败时使用兜底资源
```

## 4. 弱网和离线

第一版至少支持：

```text
关卡资源预加载
题目预取
对局中断恢复
本地临时存档
联网后同步
```

## 5. 4 核 4G 部署建议

适合第一版：

```text
Nginx
主后端 API
PostgreSQL
Redis optional
前端静态文件
```

不建议：

```text
本地部署大模型
高并发实时多人对战
大量 3D 模型直接走业务服务器
视频/大文件资源托管在应用服务器
```

## 6. 推荐部署拓扑

```text
Browser / App
  -> Nginx
      -> Frontend static files
      -> Backend API
  -> CDN/Object Storage
      -> models/textures/audio/maps

Backend API
  -> PostgreSQL
  -> Redis
  -> AI Service
  -> Object Storage metadata
```

第一版家庭内测可先用 Nginx 静态托管资源，后期资源增多后再迁移到对象存储/CDN。
