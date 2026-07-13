# 美术资源规范

## 1. 风格目标

低模或中低模，但高识别度。坦克要能看出经典风格，不追求高清写实。

## 2. 坦克模型要求

必须保留：

- 车体轮廓。
- 炮塔形状。
- 炮管比例。
- 履带比例。
- 装甲倾斜特征。
- 涂装差异。

避免：

- 真实军徽。
- 敏感符号。
- 完全复刻商用模型。
- 过高面数。

## 3. 文件格式

```text
model: .glb preferred
texture: .webp preferred
audio: .ogg preferred
map: .json
```

## 4. 命名规则

```text
models/tanks/<tank-code>/v<version>/model.glb
textures/skins/<skin-code>/v<version>/albedo.webp
audio/effects/<effect-code>/v<version>/sound.ogg
maps/<level-code>/v<version>/map.json
```

## 5. 涂装规范

涂装类型：

- 森林训练。
- 沙漠训练。
- 雪地训练。
- 海军蓝训练。
- 星星奖励。
- 节日主题。

儿童模式涂装必须友好，不使用真实战争标识。

## 6. 资源校验

每个资源必须有：

```text
assetId
type
version
hash
size
preview
dependencies
```
