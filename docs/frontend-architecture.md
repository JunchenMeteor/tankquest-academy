# 前端架构设计

## 1. 分层原则

前端分为四层：

```text
UI 层：菜单、弹窗、家长中心、结算页
游戏层：Phaser scenes、entities、systems
客户端层：API、资源、本地存档、平台能力
领域层：坦克、关卡、题目、奖励、学习记录类型和状态
```

前端不承担权威业务：

- 不判定最终奖励。
- 不决定题目正确性。
- 不直接修改坦克属性。
- 不保存正式学习进度。

## 2. 推荐目录

```text
src/
  app/
  client/
    api/
    assets/
    auth/
    platform/
    save/
    telemetry/
  game/
    engine/
    scenes/
    entities/
    systems/
    config/
  features/
    tanks/
    levels/
    learning/
    rewards/
    parent-report/
  i18n/
  theme/
  shared/
```

## 3. 游戏模块

```text
game/engine
  Phaser 初始化、资源加载、全局事件

game/scenes
  BootScene
  MenuScene
  LevelScene
  ResultScene

game/entities
  PlayerTank
  EnemyTank
  Projectile
  Obstacle
  SupplyBox

game/systems
  MovementSystem
  CombatSystem
  CollisionSystem
  EnemyAiSystem
  QuestionSystem
  ObjectiveSystem
```

## 4. UI 与游戏通信

UI 和 Phaser 不直接互相乱调。使用事件总线或状态桥。

```text
UI -> GameCommandBus -> Phaser Scene
Phaser Scene -> GameEventBus -> UI Store
```

示例事件：

```text
start_level
pause_game
resume_game
question_answered
level_completed
tank_destroyed
reward_preview
```

## 5. 文件大小约束

- 单个 UI 组件不超过 250 行。
- 单个 Phaser Scene 不超过 400 行。
- 单个 system 不超过 300 行。
- 大型配置从 API 或 config 文件读取。
- 超过限制时拆 entity、system、service、hook/composable。

## 6. 数据来源规则

前端允许的数据来源：

- 后端 API
- 正式配置文件
- seed 数据
- i18n 文案
- 本地 session draft

前端禁止：

- 在组件中硬编码正式题库
- 在组件中硬编码奖励规则
- 在组件中硬编码坦克成长数值
- 在 UI 里写假业务数据冒充功能
