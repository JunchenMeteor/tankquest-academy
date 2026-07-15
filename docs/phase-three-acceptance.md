# Phase 3 工程验收记录

验收日期：2026-07-16

## 1. 结论

Phase 3 工程范围通过验收，可以发布 v0.3.0。v0.2.0 的后端权威学习闭环已经增加可选、可降级且受严格边界约束的 AI 学习辅助：

```text
后端正式题库、判题、奖励和学习记录
-> FastAPI 提供结构化草稿、错题解释、难度建议和家长摘要
-> NestJS 校验、钳制、拒绝或使用确定性模板
-> AI 故障、无密钥或输出不安全时，游戏和报告继续工作
```

本结论只覆盖工程实现和自动化验证。正式多家庭鉴权、真实儿童与家长试用、外部模型供应商配置后的长期质量评估仍需后续验证。

## 2. 交付证据

| 范围 | 状态 | 实现与证据 |
| --- | --- | --- |
| 范围与安全边界 | 通过 | PR #86；固定 AI 不裁决正确性、奖励、升级、最终难度或正式内容发布 |
| 结构化 AI 服务 | 通过 | PR #88；FastAPI、严格 Pydantic 契约、LangChain 供应商适配、确定性模板和 SafetyGuard |
| 后端 Gateway 与部署 | 通过 | PR #90、#92、#94；NestJS 私有 Gateway、超时降级、四容器部署和服务器离线 Python wheelhouse |
| 错题解释 | 通过 | PR #96；后端先判题和写记录，AI 仅生成英中解释，正确答案回显不一致即回退 |
| 自适应练习 | 通过 | PR #98；后端选择技能、计算范围、执行家长和单步限制并映射真实已发布关卡 |
| 家长摘要 | 通过 | PR #100；只发送聚合指标，进步文案由后端趋势生成，摘要仅出现在独立家长页面 |

## 3. 验收标准

| 验收项 | 状态 | 验证方式 |
| --- | --- | --- |
| AI 健康检查、严格契约和安全拒绝 | 通过 | FastAPI 53 项测试覆盖结构、额外字段、供应商失败、诊断/能力标签、焦虑措辞、外链和隐私请求 |
| NestJS 仅通过 Gateway 调用 AI 并安全降级 | 通过 | Gateway 请求/响应 schema、超时和无效 JSON 测试；公开健康接口报告 AI 依赖状态 |
| 错题解释不改变判题和奖励 | 通过 | API 测试断言后端先记录错误答案，AI 关闭、越权或不可用时使用正式解释 |
| 自适应最终值不越过后端和家长范围 | 通过 | 纯策略测试覆盖样本不足、升降级、父级上限、上下两侧内容缺失、错误技能和重复结算 |
| 家长摘要只使用聚合数据 | 通过 | 精确 payload 测试确认无 childId、身份、日期、原始答案、题目、session 或游戏事件 |
| AI 不能伪造进步或进入儿童界面 | 通过 | NestJS 固定生成 progress；Playwright 确认摘要只在 `/parent`，英中切换重新请求报告 |
| 题目草稿不能直接发布 | 通过 | AI 服务只返回内部结构化草稿，不写题库、关卡、会话或 `published` 状态 |
| 无外部模型密钥仍可运行 | 通过 | template provider、确定性 NestJS fallback、preview 四容器和 `dependencies.ai=ok` 健康检查 |

## 4. 自动化门禁

v0.3.0 发布准备通过以下门禁：

```bash
npm run format:check
npm run db:validate
npm run lint
npm run typecheck
npm test
npm run build
```

当前单元与契约测试为 API 73、Web 42、Shared 6、AI 53 项。受保护 `Verify` 另外在干净 PostgreSQL 上执行 migration、重复 seed 和 5 项 Playwright 流程；PR 还需通过 API、Web、AI 三套容器检查。

## 5. 发布验证

v0.3.0 使用受保护分支流程：本验收 PR 合并 `main` 后先验证 preview，再通过独立 PR 将相同已验收树晋级 `release`。最终检查：

```text
https://tq-pre.jcmeteor.com/
https://tq-pre.jcmeteor.com/api/health
https://tq-pre.jcmeteor.com/parent
https://tankquest.jcmeteor.com/
https://tankquest.jcmeteor.com/api/health
https://tankquest.jcmeteor.com/parent
```

服务器还需确认 preview/release 的 Web、API、AI、PostgreSQL 容器均健康，镜像提交与目标分支合并提交一致，运行目录保持在 `/data/projects/tankquest/<environment>`。

## 6. 已知非阻塞项

- preview/release 当前使用确定性 template provider；配置真实外部模型后的提示质量、成本和长期安全表现需单独验证。
- 题目草稿已有安全内部接口，但正式内容审核与发布后台仍属于后续管理端工作。
- 正式家长登录、多家庭授权和多孩子管理不在 Phase 3 范围内。
- 家庭试用指标不能由自动化代替，仍需真实儿童和家长验证。
- Phaser 游戏 chunk 仍超过 500 kB，拆包留到性能专项。
- Prisma 6 的 seed 配置在 Prisma 7 前需迁移到独立配置文件。

