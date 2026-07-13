# 游戏引擎实现规范

## 1. 实时逻辑归前端

以下逻辑必须在游戏引擎内实时执行：

- 坦克移动
- 炮塔旋转
- 炮弹飞行
- 碰撞检测
- 敌人状态机
- 动画
- 音效
- 临时战斗反馈

不要每帧请求后端。

## 2. 后端配置驱动

后端返回：

```text
坦克基础属性
关卡地图
敌人配置
题目配置
奖励预览
资源清单
难度参数
```

前端按配置执行，不擅自修改正式规则。

## 3. 敌人 AI

第一版使用状态机：

```text
Patrol
Detect
Chase
Aim
Fire
TakeCover
Retreat
Flank
Guard
```

行为参数来自后端配置：

```json
{
  "visionRange": 5,
  "attackRange": 4,
  "retreatHpRatio": 0.25,
  "flankEnabled": true,
  "fireCooldownMs": 1500
}
```

## 4. 学习任务嵌入

题目不能作为普通弹窗打断游戏，应和场景目标绑定。

示例：

```text
正确答案弹药箱
计算题开门
英语单词补给点
方向题路线选择
物理题反弹炮弹
```

## 5. 对局事件

前端上报关键事件：

```text
enemy_defeated
player_hit
supply_collected
objective_completed
question_presented
answer_selected
level_finished
```

后端只根据可信事件和答题记录结算。

## 6. 性能要求

Web MVP 目标：

```text
Desktop: 60 FPS
Low-end laptop: 30 FPS+
Mobile Web: 30 FPS+
Initial load: 可接受分包和预加载
```

优化方式：

- 资源按关卡加载。
- 贴图合图。
- 音效复用。
- 对象池复用炮弹和敌人。
- 大模型/大贴图懒加载。
