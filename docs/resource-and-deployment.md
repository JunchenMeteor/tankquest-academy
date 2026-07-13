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

## 5. 第一阶段实际部署

当前第一阶段使用单机 Docker Compose：

```text
公网请求
  -> 主机 Nginx / TLS
      -> 127.0.0.1:3300 (release)
      -> 127.0.0.1:3301 (preview)
          -> Web Nginx / 静态文件
              -> NestJS API
                  -> 独立 PostgreSQL
```

preview 与 release 拥有独立 Compose 项目和 `/data/projects/tankquest/<environment>` 数据目录。Docker、containerd、runner 和其他工程部署数据也存放在 `/data`，但工程之间不得共享数据库或项目目录。详细路径和恢复方式见 `tencent-docker-deployment.md`。

在 4 核 4G 主机上，每个 TankQuest 环境当前限制约为：PostgreSQL 384 MB、API 384 MB、Web 96 MB。主机还承载其他工程，增加服务前必须重新检查实际内存和磁盘余量。

暂不部署：

```text
Redis
本地大模型
高并发实时多人对战
大规模模型、视频和资源文件服务
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

第一版家庭内测继续由 Web 镜像静态托管轻量资源。资源数量和体积增长后，再按本章元数据和 hash 规则迁移到对象存储/CDN；迁移不得改变游戏业务 API 的权威判定边界。
