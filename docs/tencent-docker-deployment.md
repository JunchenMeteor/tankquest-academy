# 腾讯云 Docker 部署与数据盘布局

TankQuest 与 MeteorVoice、MeteorTest 共用腾讯云主机，但各工程拥有独立的项目目录、Compose 项目、端口、数据库和回滚镜像。大体积运行数据已从系统盘迁移到挂载于 `/data` 的独立数据盘。

## 1. TankQuest 环境

| 分支 | 环境 | Compose 项目 | 主机端口 | 公网域名 |
| --- | --- | --- | ---: | --- |
| `main` | preview | `tankquest-preview` | 3301 | `tq-pre.jcmeteor.com` |
| `release` | release | `tankquest-release` | 3300 | `tankquest.jcmeteor.com` |

3300 和 3301 只监听 `127.0.0.1`，公网流量由主机 Nginx 转发。PostgreSQL 仅在对应 Compose 网络内可见。

## 2. 数据盘目录

新部署统一以 `/data` 为物理存储根目录：

```text
/data/
  projects/
    tankquest/
      preview/{deploy,postgres}/
      release/{deploy,postgres}/
    meteorvoice/
    meteortest/
  runners/
    tankquest/
    meteorvoice/
    meteortest/
    junchen-meteor/
  system/
    docker/
    containerd/
```

TankQuest 直接使用 `/data/projects/tankquest/<environment>`。每个环境的 `deploy/deployment.env` 保存镜像名、端口、数据库连接和随机数据库密码，权限为 `0600`，不得提交到仓库。

MeteorVoice、MeteorTest、既有 runner、Docker 和 containerd 通过 `/etc/fstab` bind mount 保持原路径兼容：

```text
/data/projects/meteorvoice    -> /srv/containers/meteorvoice
/data/projects/meteortest     -> /srv/containers/meteortest
/data/runners/junchen-meteor  -> /srv/actions-runner-junchen-meteor
/data/runners/meteortest      -> /srv/actions-runner-meteortest
/data/runners/meteorvoice     -> /srv/actions-runner-meteorvoice
/data/runners/tankquest       -> /srv/actions-runner-tankquest
/data/system/docker           -> /var/lib/docker
/data/system/containerd       -> /var/lib/containerd
```

这样可以让现有服务和配置继续读取原路径，同时把真实磁盘占用放到数据盘。新增工程必须创建自己的 `/data/projects/<project>`，禁止复用其他工程目录。

## 3. 服务与部署流程

- `web`：Nginx 提供 Vite 静态文件，并把 `/api/` 代理到内部 API。
- `api`：NestJS 启动前执行 Prisma migration 和幂等 seed，监听容器内 3000。
- `db`：PostgreSQL 17，数据写入对应环境的 `postgres` 目录。

`TankQuest Preview and Release` 在 PR 中验证 API/Web 镜像；合并到 `main` 或 `release` 后，Job 统一显示 `TankQuest / Deploy preview or release`，具体目标由 `Resolve target` 步骤记录为 `preview` 或 `release`。TankQuest self-hosted runner 构建带提交 SHA 的镜像并调用 `deploy/deploy-container.sh`。部署必须通过 Compose health check 和本机 `/api/health` 检查。

如果新容器失败，脚本恢复 `deployment.env` 中记录的上一组 API/Web 镜像。数据库目录不会被部署或回滚流程删除。

## 4. 端口分配

| 工程 | release | preview |
| --- | ---: | ---: |
| 个人官网 | 3001 | - |
| MeteorVoice | 3100 | 3101 |
| MeteorTest | 3200 | 3201 |
| TankQuest | 3300 | 3301 |

新服务分配端口前先运行 `ss -lntp` 和 `docker ps`，按工程连续预留，不得仅根据文档假设端口空闲。

## 5. 验证

```bash
findmnt /data
findmnt --verify
df -h / /data

docker compose --project-name tankquest-preview \
  --env-file /data/projects/tankquest/preview/deploy/deployment.env \
  --file /data/projects/tankquest/preview/deploy/docker-compose.yml ps

curl --fail http://127.0.0.1:3301/api/health
curl --fail https://tq-pre.jcmeteor.com/api/health
```

release 使用 3300 和 `/data/projects/tankquest/release`。迁移或维护完成后还要确认：

- 所有业务容器为 running/healthy。
- 四个 self-hosted runner 为 online/idle。
- MeteorVoice、MeteorTest、TankQuest 的 preview/release 域名可访问。
- `/var/lib/docker`、`/var/lib/containerd` 和旧 `/srv` 路径实际落在 `/data`。
- `findmnt --verify` 没有错误。

## 6. 镜像保留与清理

每个工程、每个环境保留：

1. 当前运行镜像。
2. 最近一个已验证、可回滚镜像。

首次发布还没有前一版本时，只保留当前镜像。清理前必须从 `docker inspect` 和各环境 `deployment.env` 确认引用关系；只删除已明确识别的旧标签和停止容器，不执行全局 `docker system prune`。

containerd 目录是 Docker 运行时内容和元数据存储，不等同于“全部历史回滚镜像”。可回滚能力以 Docker 中实际保留的镜像和环境配置为准。

## 7. 备份与恢复

- PostgreSQL：变更 schema 或发布高风险版本前，按环境执行逻辑备份并把备份放在对应工程的独立备份目录或外部存储。
- 配置：备份 `/etc/fstab`、Nginx 站点配置和各环境 `deployment.env`；配置备份必须按密钥处理。
- 数据盘：恢复时先挂载 `/data`，再执行 `mount -a` 恢复兼容 bind mount，最后启动 Docker 和 runner 服务。
- 回滚：优先使用 `deployment.env` 记录的上一组镜像；数据库迁移不可逆时必须按迁移说明恢复备份。

不得在未确认数据盘挂载成功时启动 Docker 或数据库容器，避免服务在系统盘同名空目录中写入新数据。
