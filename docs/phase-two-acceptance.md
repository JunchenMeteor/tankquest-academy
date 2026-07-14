# Phase 2 工程验收记录

验收日期：2026-07-15

## 1. 结论

Phase 2 工程范围通过验收，可以发布 v0.2.0。核心闭环已经从单坦克数学任务扩展为：

```text
选择三辆已拥有坦克和持久化涂装
-> 完成数学、英语或方向任务
-> 后端判题并按学科/技能记录学习表现
-> 后端结算奖励和升级
-> 家长在独立页面查看确定性 30 天报告
```

本结论只覆盖工程实现和自动化验证。正式多家庭鉴权、真实儿童首次操作、单局时长、重复游玩意愿和家长理解度仍需家庭试用验证。

## 2. 交付证据

| 范围 | 状态 | 实现与证据 |
| --- | --- | --- |
| 多坦克 | 通过 | PR #68；后端按孩子所有权返回星盾、迅狐、铁山，选择的坦克进入对局、升级和结算 |
| 涂装 | 通过 | PR #72；每辆坦克两套原创涂装，所有权和装备持久化，涂装只改变 Phaser 外观 |
| 多语言与主题 | 通过 | PR #74；默认英语、简体中文切换和三套持久化主题 |
| 学习记录 | 通过 | PR #76；答题与聚合处于同一事务，按孩子、学科和技能保存次数、正确数、平均耗时和难度 |
| 家长报告 | 通过 | PR #78；独立 `/parent` 页面展示 30 天完成局数、正确率、平均耗时、近期技能和确定性建议 |
| 英语与方向任务 | 通过 | PR #80；后端 seed 提供词义匹配、左右与方位题，复用数学任务的判题、结算和记录链路 |

## 3. 验收标准

| 验收项 | 状态 | 验证方式 |
| --- | --- | --- |
| 三辆已拥有坦克可选择并启动 | 通过 | API 所有权校验、浏览器选择迅狐并验证对局快照 |
| 涂装装备刷新后保留且无数值加成 | 通过 | 装备 API、刷新后会话外观断言和共享战斗属性测试 |
| 三学科由后端判定并进入学习记录 | 通过 | Playwright 通过 API 完成三学科会话并检查进度聚合 |
| 家长能理解完成内容和关注技能 | 通过 | 独立家长页面 E2E 验证学科、技能、正确率、耗时和下一步建议 |
| 未拥有坦克或涂装被拒绝 | 通过 | progression 服务所有权测试和 API 边界 |
| 儿童界面不能直接进入家长报告 | 通过 | E2E 确认儿童主页没有家长报告链接，报告仅由独立路径进入 |
| 迁移、契约、幂等、安全和浏览器闭环 | 通过 | `Verify` 在干净 PostgreSQL 上迁移、重复 seed、运行单元测试、构建和 Playwright |

## 4. 自动化门禁

发布准备必须通过：

```bash
npm run format:check
npm run db:validate
npm run lint
npm run typecheck
npm test
npm run build
```

CI 另外执行 PostgreSQL migration、幂等 seed 和完整 Playwright 套件。PR 还必须通过 API/Web Docker 运行时镜像构建。

## 5. 发布验证

v0.2.0 使用受保护分支流程：功能 PR 合并 `main` 后由统一的 `TankQuest / Deploy preview or release` Job 验证 preview，再通过 PR 晋级 `release`。最终检查：

```text
https://tq-pre.jcmeteor.com/
https://tq-pre.jcmeteor.com/api/health
https://tankquest.jcmeteor.com/
https://tankquest.jcmeteor.com/api/health
```

服务器上还需确认 preview/release 各自的 Web、API、PostgreSQL 容器健康，运行目录保持在 `/data/projects/tankquest/<environment>`。

## 6. 已知非阻塞项

- 正式家长登录、多家庭授权和多孩子管理不在 Phase 2 范围内。
- 家庭试用指标不能由自动化代替，仍需真实儿童和家长验证。
- Phaser 游戏 chunk 仍超过 500 kB，拆包留到性能专项。
- Prisma 6 的 seed 配置在 Prisma 7 前需迁移到独立配置文件。
