# API 契约规范

## 1. 通用规范

所有 API 使用 JSON。

```text
Content-Type: application/json
Authorization: Bearer <token>
```

响应格式：

```json
{
  "data": {},
  "error": null,
  "requestId": "req_xxx"
}
```

错误格式：

```json
{
  "data": null,
  "error": {
    "code": "LEVEL_NOT_FOUND",
    "message": "Level not found"
  },
  "requestId": "req_xxx"
}
```

## 2. 关键接口

### 创建对局

```text
POST /api/game-sessions
```

请求：

```json
{
  "childId": "child_001",
  "levelId": "level_001",
  "tankId": "tank_001"
}
```

响应：

```json
{
  "sessionId": "session_001",
  "level": {},
  "tank": {},
  "questions": [],
  "assets": []
}
```

### 提交答案

```text
POST /api/game-sessions/:sessionId/answers
```

请求：

```json
{
  "questionId": "q_001",
  "selectedAnswerId": "a",
  "answerTimeMs": 4200,
  "locale": "zh-CN"
}
```

响应：

```json
{
  "correct": true,
  "explanation": "8 + 7 = 15",
  "resourceReward": {
    "type": "ammo",
    "amount": 1
  }
}
```

### 提交事件

```text
POST /api/game-sessions/:sessionId/events
```

请求：

```json
{
  "eventType": "enemy_defeated",
  "payload": {
    "enemyId": "enemy_001"
  },
  "clientTimeMs": 53000
}
```

### 结束对局

```text
POST /api/game-sessions/:sessionId/finish
```

响应：

```json
{
  "stars": 2,
  "rewards": [
    { "type": "part", "key": "cannon", "amount": 3 }
  ],
  "learningSummary": {
    "correct": 4,
    "total": 5
  },
  "nextPractice": {
    "levelId": "level_002",
    "subject": "math",
    "skillKey": "addition-within-20",
    "difficulty": 2,
    "intent": "challenge",
    "decision": "adopted",
    "reason": "within_policy"
  }
}
```

`nextPractice` 是可选字段。主后端根据聚合学习记录、家长上限和已发布内容确定最终推荐并随结算持久化；AI 只能在后端给定的难度范围内提供建议，不能返回或选择 `levelId`。客户端点击推荐时只预选任务，不自动开始对局。

### 获取家长报告

```text
GET /api/children/:childId/report?locale=en|zh-CN
```

报告继续返回主后端计算的 30 天学科、技能、正确率、耗时和关注技能，并增加可降级的四段 `summary`：练习内容、进步证据、需要支持和下一步建议。`summary.source` 只区分 `deterministic` 与 `model`；供应商内部请求 ID、错误和原始响应不会暴露给客户端。

主后端使用前后半窗口且每窗至少五次尝试来确定技能趋势。AI 只能表述主后端已经确定的聚合事实，不能修改指标、趋势、关注技能、奖励或进度；进步段落始终由主后端根据趋势生成。无数据、AI 不可用或输出不安全时返回本地确定性摘要。

## 3. 错误码示例

```text
UNAUTHORIZED
FORBIDDEN
CHILD_PROFILE_REQUIRED
LEVEL_NOT_FOUND
TANK_NOT_UNLOCKED
SESSION_NOT_FOUND
SESSION_ALREADY_FINISHED
QUESTION_NOT_IN_SESSION
INVALID_ANSWER
PARENT_CONTROL_BLOCKED
```

## 4. 契约要求

- API DTO 必须有类型定义。
- 前端不得依赖未声明字段。
- 新增 API 必须补请求、响应、错误码和权限。
- 奖励、升级、答题判定必须由后端返回。
