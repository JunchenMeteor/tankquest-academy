# 后台管理端设计

## 1. 后台定位

后台管理端用于维护游戏内容和运营配置，不面向儿童玩家。后台必须支持题库、关卡、坦克、涂装、奖励、资源、多语言、主题、AI 内容审核和家长/孩子数据查看。

后台不是游戏客户端，不承载实时对局逻辑。

## 2. 用户角色

```text
admin
  全权限，管理用户、角色、系统配置。

content_editor
  管理题库、关卡、文案、学习内容。

game_designer
  管理坦克、敌人、涂装、奖励、关卡参数。

asset_manager
  管理模型、贴图、音效、地图资源。

reviewer
  审核 AI 生成题目、解释和报告模板。

parent
  只查看自己孩子的数据，不进入运营后台。
```

## 3. 权限原则

- 后台权限必须 RBAC 化。
- 所有发布类操作必须记录审计日志。
- 题库、关卡、奖励、AI 内容必须有草稿和发布流程。
- 普通编辑不能直接修改线上已发布内容，必须创建新版本。

## 4. 后台模块

### 4.1 仪表盘

展示：

```text
今日活跃孩子数
关卡完成次数
平均答题正确率
高失败率关卡
AI 内容待审核数量
资源加载失败数量
```

### 4.2 题库管理

能力：

```text
创建题目
编辑题目
批量导入
按年龄/模式/学科/难度筛选
答案校验
解释文案维护
AI 生成题目审核
发布/下线题目
```

题目状态：

```text
draft
reviewing
published
archived
rejected
```

### 4.3 关卡管理

能力：

```text
配置关卡基础信息
选择地图资源
配置目标
配置敌人类型和数量
配置题目池
配置奖励规则
配置难度范围
预览关卡配置
发布新版本
```

关卡配置不能直接写死在前端。

### 4.4 坦克管理

能力：

```text
配置坦克名称和描述
绑定模型资源
配置基础属性
配置角色定位
配置解锁条件
配置升级上限
配置儿童模式可见性
```

基础属性：

```text
火力
机动
装甲
隐蔽
视野
```

### 4.5 涂装管理

能力：

```text
绑定贴图资源
配置适用坦克
配置主题
配置解锁条件
配置轻量属性加成
配置是否儿童可用
```

涂装不能包含真实军徽、敏感符号或受版权保护标识。

### 4.6 奖励规则管理

能力：

```text
配置星级规则
配置零件掉落
配置徽章解锁
配置金币/训练点
配置连续失败补偿
配置每日上限
```

奖励规则必须后端结算，前端只展示结果。

### 4.7 资源管理

能力：

```text
上传资源
配置资源类型
记录版本
计算 hash
预览模型/贴图/音效
查看依赖关系
下线旧资源
```

资源类型：

```text
model
texture
audio
map
tileset
icon
ui
```

### 4.8 多语言文案管理

能力：

```text
维护 i18n key
中文/英文/其他语言翻译
检查缺失翻译
检查未使用 key
导出/导入文案
```

后台保存 key，前端使用 key，不允许前端硬编码业务文案。

### 4.9 主题管理

能力：

```text
配置主题名称
配置颜色
绑定 tileset
绑定音乐
绑定背景资源
配置适用关卡
```

主题只影响视觉，不改变核心业务规则。

### 4.10 AI 内容审核

审核对象：

```text
AI 生成题目
AI 错题解释
AI 家长报告模板
AI 趣味心理测试题
```

审核要求：

```text
答案正确
适合年龄
没有成人内容
没有心理/医学诊断
没有外链诱导
没有真实战争煽动
```

AI 内容未审核前不能进入正式题库。

### 4.11 用户与学习数据查看

能力：

```text
查看孩子档案
查看学习进度
查看关卡记录
查看答题正确率
查看家长控制设置
查看异常对局
```

后台用户只能看必要数据，不能暴露过多儿童隐私。

## 5. 发布流程

所有运营配置走统一流程：

```text
draft -> reviewing -> published -> archived
```

线上内容修改必须生成新版本：

```text
level_001 v1 published
level_001 v2 draft
level_001 v2 reviewing
level_001 v2 published
```

## 6. 审计日志

必须记录：

```text
操作者
操作类型
对象类型
对象 ID
变更前摘要
变更后摘要
操作时间
IP/设备信息
```

关键操作：

```text
发布关卡
发布题目
修改奖励
修改坦克属性
修改儿童安全设置
审核 AI 内容
删除/归档资源
```

## 7. 后台前端技术建议

后台可以和游戏官网前端共用技术栈，但建议独立应用：

```text
Vite + React/Vue
TypeScript
TanStack Table / Naive UI / Ant Design Vue
Zod 或类似 schema 校验
```

后台 UI 风格应该偏工具型，不做游戏化装饰。

## 8. 后台 API 示例

```text
GET    /api/admin/questions
POST   /api/admin/questions
PATCH  /api/admin/questions/:id
POST   /api/admin/questions/:id/publish

GET    /api/admin/levels
POST   /api/admin/levels
PATCH  /api/admin/levels/:id
POST   /api/admin/levels/:id/publish

GET    /api/admin/tanks
POST   /api/admin/tanks
PATCH  /api/admin/tanks/:id

GET    /api/admin/assets
POST   /api/admin/assets
POST   /api/admin/assets/:id/archive

GET    /api/admin/ai/reviews
POST   /api/admin/ai/reviews/:id/approve
POST   /api/admin/ai/reviews/:id/reject
```

## 9. 开发约束

- 后台只调用后台 API，不直接访问数据库。
- 表单必须有前端校验和后端校验。
- 发布操作必须二次确认。
- 删除优先做归档，不做物理删除。
- 后台列表必须支持分页、搜索和筛选。
- 所有业务文案使用 i18n key。
- 管理端不能绕过儿童安全规则。
