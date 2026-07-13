# 后端架构设计

## 1. 后端职责边界

主后端是游戏业务的权威状态机。所有确定性业务必须由主后端裁决。

主后端负责：

- 用户和孩子档案
- 家长控制
- 坦克数据、升级和涂装
- 关卡配置
- 题库管理
- 对局开始、事件记录和结算
- 答题判定
- 奖励发放
- 学习记录
- 家长报告数据
- AI 服务调用和结果校验

前端负责：

- 游戏渲染
- 输入控制
- 碰撞、移动、实时敌人 AI
- 资源加载
- 展示题目、奖励、报告
- 上报对局事件

AI 服务负责：

- 生成题目草稿
- 错题解释
- 学习建议
- 报告文案
- 难度建议

## 2. 模块划分

```text
auth
users
children
parent-controls
tanks
skins
levels
questions
game-sessions
rewards
learning
reports
assets
admin
ai-gateway
telemetry
```

## 3. 对局流程

```text
1. 前端请求开始关卡
2. 后端校验孩子档案、模式、坦克、关卡权限
3. 后端创建 game_session
4. 后端返回关卡配置、题目、坦克参数、资源清单
5. 前端执行游戏
6. 前端上报答题和关键事件
7. 后端判定答案、记录事件、返回反馈
8. 前端结束关卡
9. 后端结算星星、零件、徽章、经验
10. 后端更新学习记录和坦克进度
```

## 4. API 草案

```text
POST   /api/auth/login
POST   /api/auth/refresh

GET    /api/children
POST   /api/children
GET    /api/children/:childId/profile
PATCH  /api/children/:childId/parent-controls

GET    /api/tanks
GET    /api/tanks/:tankId
GET    /api/children/:childId/tanks
POST   /api/children/:childId/tanks/:tankId/upgrade
POST   /api/children/:childId/skins/:skinId/equip

GET    /api/levels
GET    /api/levels/:levelId
POST   /api/game-sessions
POST   /api/game-sessions/:sessionId/answers
POST   /api/game-sessions/:sessionId/events
POST   /api/game-sessions/:sessionId/finish

GET    /api/children/:childId/progress
GET    /api/children/:childId/report

GET    /api/assets/manifest
POST   /api/ai/questions/generate
POST   /api/ai/explanations
POST   /api/ai/reports/summarize
```

## 5. 难度系统

难度由主后端裁决，AI 只提供建议。

输入因素：

```text
childAge
selectedMode
tankPower
levelBaseDifficulty
recentAccuracy
recentFailCount
averageAnswerTime
combatDamageTaken
sessionDuration
```

输出配置：

```text
enemyCount
enemyTypes
enemyAggression
questionDifficulty
hintLevel
rewardMultiplier
```

AI 可以返回建议，但后端必须校验建议是否在允许范围内。

## 6. 敌人智能

实时敌人 AI 在前端游戏引擎执行，后端只返回行为参数。

后端配置：

```json
{
  "enemyType": "scout_bot",
  "stats": {
    "hp": 2,
    "speed": 1.3,
    "vision": 5,
    "fireRate": 0.7
  },
  "behavior": {
    "patrol": true,
    "flank": true,
    "retreatHpRatio": 0.25,
    "attackRole": "harass"
  }
}
```

前端执行状态机：

```text
Patrol -> Detect -> Chase -> Aim -> Fire
                 -> TakeCover
                 -> Retreat
                 -> Flank
```

## 7. 安全原则

- 前端上报事件不等于后端认可。
- 奖励必须后端结算。
- 答题正确性必须后端判定。
- AI 输出必须校验后返回。
- 儿童模式和成人模式必须隔离。
- 管理后台所有配置必须有发布流程。
