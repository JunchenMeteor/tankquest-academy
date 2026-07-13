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
  "answerTimeMs": 4200
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
  }
}
```

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
