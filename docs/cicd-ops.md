# CI/CD 与运维规范

## 1. 环境与分支

| 分支 | 环境 | 域名 | 用途 |
| --- | --- | --- | --- |
| 功能分支 | PR validation | - | CI 和部署镜像构建验证 |
| `main` | preview | `tq-pre.jcmeteor.com` | 合并后自动部署、验收 |
| `release` | release | `tankquest.jcmeteor.com` | 受保护 PR 晋级、正式部署 |

禁止直接 push 到 `main` 或 `release`。所有改动从 Issue 开始，经功能分支、PR 和检查后 squash merge。

## 2. GitHub Actions

- `CI`：安装依赖，执行格式、lint、typecheck、单元测试、E2E 和生产构建。
- `TankQuest Preview and Release`：PR 验证 Docker 构建；`main`/`release` push 部署对应环境并执行健康检查；部署 Job 统一显示 `TankQuest / Deploy preview or release`。
- `TankQuest Release Manager`：按版本创建 Issue/PR，把 `main` 晋级到 `release`，等待部署后创建 GitHub Release。

发布操作见 `release-manager.md`，主机拓扑和数据路径见 `tencent-docker-deployment.md`。

AI 运行时的 Linux wheelhouse 由 GitHub hosted runner 使用 Python 3.13 生成并作为提交 SHA 专属 artifact 传给部署 Job。目标服务器从 wheelhouse 离线组装 AI 镜像，不在部署期间访问 PyPI。

## 3. 运行配置

主 API 运行时使用：

```text
DATABASE_URL
HOST
NODE_ENV
PORT
AI_SERVICE_URL
AI_SERVICE_TIMEOUT_MS
```

AI 服务运行时使用：

```text
AI_PROVIDER
AI_MODEL
OPENAI_API_KEY
```

`AI_PROVIDER` 默认是无需密钥的 `template`。只有切换到 `openai` 时才需要在服务器权限为 `0600` 的 `deployment.env` 写入模型标识和密钥；部署脚本会保留这些值，但不会输出它们。

部署层另使用 `API_IMAGE`、`AI_IMAGE`、`WEB_IMAGE`、`HOST_PORT`、`POSTGRES_PASSWORD` 和 `POSTGRES_DATA_PATH`。真实密钥只保存在 GitHub Secret 或服务器 `deployment.env`，禁止提交。

新增 Redis、JWT、AI 服务、对象存储或 CDN 后，必须先在代码中接入并校验，再把对应环境变量加入部署文档，不能提前把未使用变量当成生产依赖。

## 4. 数据库迁移

- 每次 schema 修改必须有 migration。
- migration 必须可回滚，或明确说明不可回滚及恢复步骤。
- 生产环境迁移前备份对应 PostgreSQL 数据库。
- API 容器启动时执行 migration 和幂等 seed；失败时部署不得继续通过健康检查。

## 5. 发布与回滚

```text
功能分支验证
-> PR CI / Docker validation
-> squash merge main
-> preview 部署与健康检查
-> main 到 release 的受保护 PR
-> release 部署与健康检查
-> GitHub Release
```

部署失败时恢复上一组已验证 API/AI/Web 镜像和 Compose 配置。每个环境只保留当前镜像和最近一个回滚镜像，清理必须精确到标签，不做全局 prune。

## 6. 备份

至少备份：

- preview/release PostgreSQL。
- `/etc/fstab`、Nginx 配置和部署环境配置。
- 后续接入的资源元数据和管理后台配置。

资源文件本体接入对象存储后使用对象版本管理。备份不得与唯一数据副本放在同一故障域。

## 7. 监控与巡检

第一阶段最低巡检项：

- Web 页面和 `/api/health` 公网检查。
- Compose 容器 running/healthy 状态。
- self-hosted runner online/idle 状态。
- 系统盘和 `/data` 容量、inode 使用率。
- API 错误、响应时间、数据库连接和 AI `degraded` 比例。
- Nginx 证书有效期和代理错误。

后续接入对象存储和登录后，再增加资源加载失败和登录失败监控。
