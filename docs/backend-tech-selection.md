# 后端技术选型

## 1. 选型目标

后端需要支撑坦克学习游戏的确定性业务逻辑，包括用户、孩子档案、题库、关卡、坦克、涂装、奖励、学习记录、家长报告和 AI 服务接入。

核心原则：

- 主后端负责权威业务规则。
- AI 服务只提供建议、解释和内容草稿。
- 前端不直接决定奖励、升级、答题正确性和学习进度。
- 第一阶段优先模块化单体，后续再拆服务。

## 2. 推荐架构

```text
前端游戏客户端
  -> 主后端 API
      -> PostgreSQL
      -> Redis
      -> 对象存储/CDN
      -> AI 服务
          -> LangChain / LangGraph
          -> LLM API
```

## 3. 主后端选型

### 方案 A: NestJS

推荐用于快速推进、前后端都使用 TypeScript 的团队。

```text
Runtime: Node.js
Framework: NestJS
ORM: Prisma
Database: PostgreSQL
Cache: Redis
Auth: JWT + refresh token
API: REST first, later GraphQL optional
Validation: class-validator / zod
Test: Jest
```

优点：

- 前后端都用 TypeScript，AI 开发和类型共享更顺。
- NestJS 模块结构清晰，适合按领域拆分。
- Prisma 迁移和类型体验好。
- 对 Web 游戏、后台 API、配置管理足够。

风险：

- 需要保持架构纪律，避免 service 变成超大文件。
- 高 CPU 任务不适合直接放 Node 主线程。

### 方案 B: Spring Boot

推荐用于长期产品、Java 生态、企业环境或你想重点学习 Java 后端。

```text
Runtime: JVM
Framework: Spring Boot
ORM: MyBatis Plus / JPA
Database: PostgreSQL
Cache: Redis
Auth: Spring Security + JWT
Test: JUnit
```

优点：

- 稳定、成熟、权限和后台生态强。
- 适合长期复杂业务。
- 大量企业实践可参考。

风险：

- 初期开发成本略高。
- 4 核 4G 服务器需要控制 JVM 内存。

## 4. AI 服务选型

AI 服务建议独立为 Python 服务：

```text
Framework: FastAPI
AI orchestration: LangChain / LangGraph
Validation: Pydantic
Task queue: Celery/RQ optional
```

AI 服务负责：

- 题目草稿生成
- 错题解释
- 个性化练习建议
- 家长报告总结
- 成人趣味测试文案

AI 服务不负责：

- 答题判定
- 奖励结算
- 坦克升级
- 关卡通关
- 直接写业务数据库

## 5. 数据库和缓存

推荐：

```text
PostgreSQL: 主数据库
Redis: 会话缓存、限流、临时题目、排行榜、异步任务状态
```

第一版可以不用 Redis，但接口需要保留缓存层封装。

## 6. 部署建议

4 核 4G 轻量服务器可运行第一版：

```text
Nginx
主后端
PostgreSQL
Redis optional
AI 服务 optional
```

不建议在该服务器本地部署大模型。AI 调用外部模型 API。

## 7. 最终建议

如果目标是快速做 MVP：

```text
NestJS + PostgreSQL + Prisma + FastAPI AI 服务
```

如果目标是练 Java 和长期稳态产品：

```text
Spring Boot + PostgreSQL + Redis + FastAPI AI 服务
```

第一阶段建议逻辑拆分清楚，但部署可以先是模块化单体。不要过早上微服务、Kubernetes 或复杂网关。
