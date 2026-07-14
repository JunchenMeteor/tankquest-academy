# 坦克学习游戏文档入口

## 1. AI 开发阅读顺序

AI 开始开发前，按这个顺序阅读，不要一上来读所有文件。

### 第一组：先确定做什么

1. `tank-learning-game-dev-spec.md`
   - 产品总纲、玩法闭环、核心体验。

2. `mvp-scope.md`
   - 第一版必须做什么、不做什么、验收标准。

3. `implementation-roadmap.md`
   - PR/阶段拆分顺序。

### 第二组：确定工程架构

4. `backend-tech-selection.md`
   - 后端技术选型。

5. `frontend-tech-selection.md`
   - 前端技术选型。

6. `backend-architecture.md`
   - 主后端职责、模块、流程。

7. `frontend-architecture.md`
   - 前端分层、目录、游戏模块。

8. `client-layer-design.md`
   - 后续 Web/Windows/手机共用的客户端层。

### 第三组：实现核心闭环

9. `database-design.md`
   - 数据库草案。

10. `api-contract.md`
    - API 契约。

11. `game-engine-guidelines.md`
    - Phaser/游戏实时逻辑规范。

12. `game-balancing.md`
    - 数值、奖励、升级、难度规则。

### 第四组：补充系统能力

13. `admin-console-design.md`
    - 后台管理端。

14. `resource-and-deployment.md`
    - 资源文件、CDN、部署。

15. `frontend-theme-i18n.md`
    - 多主题、多语言、UI 文案。

16. `art-asset-guidelines.md`
    - 模型、贴图、音效、地图资源标准。

### 第五组：安全、AI、质量

17. `ai-service-and-safety.md`
    - AI 服务边界。

18. `ai-prompt-guidelines.md`
    - AI prompt 和审核规范。

19. `security-privacy.md`
    - 儿童安全和隐私。

20. `testing-quality.md`
    - 测试和质量门禁。

21. `cicd-ops.md`
    - CI/CD、部署、监控。

22. `backend-safety-ops.md`
    - 家长控制、后台运营、数据指标。

23. `multi-platform-packaging.md`
    - 后续 Windows/手机打包。

24. `tencent-docker-deployment.md`
    - 腾讯云 Docker 部署拓扑、数据路径和验证方式。

25. `release-manager.md`
    - 版本准备、受保护分支晋级和 GitHub Release 自动化。

26. `phase-one-mvp-acceptance.md`
    - 第一阶段工程验收证据、家庭试用门槛和已知非阻塞项。

27. `phase-one-six-combat-scope.md`
    - Phase 1.6 穿深、方向装甲、命中反馈和验收边界。

28. `phase-two-scope.md`
    - Phase 2 多坦克、涂装、学习记录、家长报告和新学科范围。

29. `phase-two-acceptance.md`
    - Phase 2 工程验收证据、发布验证和已知非阻塞项。

## 2. 第一阶段开发顺序

第一阶段不要做全量功能，只做 MVP。

```text
1. 项目脚手架
2. 数据库基础模型
3. 后端核心 API
4. 前端 Phaser 游戏壳
5. 坦克移动/射击/碰撞
6. 数学题任务
7. 对局结算
8. 奖励和升级
9. 简单后台配置
10. 测试和构建
```

## 3. 第一版不读或只粗读

第一版可以暂时不深入：

```text
ai-prompt-guidelines.md
multi-platform-packaging.md
art-asset-guidelines.md
cicd-ops.md
```

这些用于后续扩展，不应阻塞 MVP。

## 4. 给 AI 的启动提示

```text
请先阅读 tank-learning-game-docs/tank-learning-game-dev-spec.md、tank-learning-game-docs/mvp-scope.md、
tank-learning-game-docs/implementation-roadmap.md。

当前只实现 MVP，不做多人、不做完整 3D、不做移动端、不做复杂 AI。
开发时必须遵守前后端分离，题库/关卡/坦克参数不能硬编码在 UI 组件中，
奖励和答题判定以后端为准。
```
