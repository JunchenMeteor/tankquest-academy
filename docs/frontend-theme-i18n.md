# 前端主题与多语言规范

## 1. 多主题

主题用于改变视觉氛围，不改变核心业务规则。

建议主题：

```text
训练基地
森林营地
沙漠靶场
雪地补给线
太空训练场
```

主题配置：

```json
{
  "id": "snow-field",
  "nameKey": "theme.snowField.name",
  "palette": {
    "primary": "#4f7fbf",
    "ground": "#dceaf5",
    "accent": "#f7c948"
  },
  "tileSetAssetId": "tileset_snow_v1",
  "musicAssetId": "music_snow_loop_v1"
}
```

## 2. 多语言

所有用户可见文案必须使用 i18n key。

```text
action.start
action.pause
tank.mountainHeavy.name
level.forestSupply.title
question.math.addition
reward.part.cannon
```

禁止在组件里直接写正式业务文案。

## 3. 儿童语言风格

儿童模式文案要求：

- 简短
- 正向
- 不羞辱
- 不制造焦虑
- 错题解释要具体

示例：

```text
不推荐：你答错了。
推荐：再试一次。可以先把 9 拆成 4 和 5。
```

## 4. 成人模式文案

成人模式可以更幽默，但仍需避免：

- 医学诊断
- 心理标签化
- 政治/战争煽动
- 高风险建议

## 5. UI 规范

- 游戏 HUD 信息少而清楚。
- 儿童模式按钮足够大。
- 移动端支持触控。
- 颜色不能只依赖红绿区分。
- 重要反馈同时使用图形、文字和音效。
- 弹窗不能频繁打断对局。

## 6. 样式组织

```text
theme/
  tokens.ts
  themes/
  components/
```

样式变量：

```text
color
spacing
radius
font
shadow
motion
zIndex
```

不要把全局样式写成不可控的大 CSS 文件。
