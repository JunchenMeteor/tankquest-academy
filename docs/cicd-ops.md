# CI/CD 与运维规范

## 1. 环境

```text
local
dev
staging
production
```

## 2. 环境变量

必须分环境管理：

```text
DATABASE_URL
REDIS_URL
JWT_SECRET
AI_SERVICE_URL
OBJECT_STORAGE_ENDPOINT
CDN_BASE_URL
```

禁止提交真实密钥。

## 3. CI 检查

```text
install
lint
typecheck
unit test
contract test
build
database migration check
```

## 4. 数据库迁移

- 每次 schema 修改必须有 migration。
- migration 必须可回滚或说明不可回滚。
- 生产环境迁移前备份。

## 5. 部署流程

```text
构建前端
构建后端
运行测试
执行迁移
部署服务
健康检查
 smoke test
```

## 6. 备份

至少备份：

- PostgreSQL。
- 资源元数据。
- 管理后台配置。

资源文件本体使用对象存储版本管理。

## 7. 监控

监控：

- API 错误率。
- 响应时间。
- 数据库连接。
- AI 服务失败率。
- 资源加载失败。
- 登录失败次数。
