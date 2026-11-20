# 坦克模型接入说明

战斗画面仅在高画质下加载 `apps/web/public/models/tank-scout.glb`、`tank-medium.glb`、`tank-heavy.glb`，中/低画质使用程序化模型。每种车型独立缓存，但共享同一套 `TankRig` 关节契约，运行时不再根据包围盒猜测车头、炮塔或炮口。

## 文件要求

- 格式：`.glb`（二进制 glTF 2.0），单文件，贴图内嵌
- 坐标：源文件需为 Y 向上，车头与炮管静止方向一致；运行时归一化为 **+X 车头方向**、车长 6 个世界单位
- 朝向：模型原点位于车体中心地面处（履带底面 y≈0）；归一化变换放在内部节点，外层根节点只负责行驶位置与朝向

## 必需节点结构

```text
TankRig
├── Hull
│   ├── Tracks_420
│   ├── Wheel_L_00 … Wheel_L_06
│   ├── Wheel_R_00 … Wheel_R_06
│   ├── Applique_Hull
│   ├── Gear_Hull
│   ├── Glass_Hull
│   └── 其他车体部件
├── TurretPivot
│   ├── Turret_229
│   ├── Applique_Turret
│   ├── Gear_Turret
│   ├── Glass_Turret
│   ├── Gear_24
│   └── GunPivot
│       ├── Gear_Gun_Mantlet
│       ├── Glass_Gun
│       └── RecoilPivot（需要独立后坐的车型）
│           ├── Barrel_Cannon_13
│           └── Muzzle
```

同一材质可以同时覆盖车体、炮塔和炮管上的不同物理部件，不能按材质名把整块网格挂到单一关节。混合网格必须在 Blender 中按实际部件拆分为上述区域节点，保留原 UV 与贴图；运行时不得再整组重挂 `Applique`、`Gear` 或 `Glass`。

`SideSkirts_477` 是主装甲侧裙，必须使用车型的 `primaryColor`，不能与储物箱、天线等 `Gear` 附件一起使用高亮 `secondaryColor`，否则大面积色块会产生两套车壳重叠的观感。

## 轻、中、重独立车型

`swift-fox`、`star-shield`、`iron-mountain` 分别映射为 `scout`、`medium`、`heavy`，车库与战斗必须使用同一映射。每种车型使用独立 GLB 和独立缓存，不再通过缩放同一模型或添加外挂装甲来伪造差异。

- 轻型使用 buffinbag 的 M24 Chaffee（霞飞）原生 PBR 模型。源网格按连通组件重新分组，每侧保留 5 个独立负重轮、1 个前主动轮、1 个后诱导轮和 3 个托带轮，不生成替代圆柱轮。
- 中型使用 T-34-85 的原生 PBR 材质和独立轮节点。
- 重型使用 Tiger I 的原生 PBR 材质，左右轮组拆分后分别挂到正确关节；源炮管朝 `+Y` 时先旋转 180° 统一为 `-Y`，再归一化为战斗的 `+X` 前向。
- 所有车型必须保留 `Hull`、`TurretPivot`、`GunPivot`、`Muzzle` 层级、真实滚动半径和真实炮口；车体件与炮塔件不得互相遗留或重复显示。`Muzzle` 相对 `GunPivot` 必须有非零位移，不能因未刷新的世界矩阵而退化为车体原点。

- `TurretPivot` 的原点必须位于真实炮塔回转轴。
- `GunPivot` 的原点必须位于真实耳轴中心，不能按车型统一猜测包围盒的某一端；GLB 炮管局部前向为 +Z，因此绕局部 X 轴俯仰。俯仰时枢轴的局部位置保持不变，只有炮口与炮盾围绕它转动。
- `Muzzle` 是真实炮口位置，必须位于 `GunPivot` 的 +Z 前方，炮弹和火光直接读取其世界坐标，不能用固定炮管长度代替。开炮后坐沿 `Muzzle` 在炮管局部空间的方向后退并回弹，不能使用横轴平移。带独立 `RecoilPivot` 的车型只移动该节点下的炮管和炮口，不能平移 `GunPivot` 或炮盾。
- 重坦 Tiger I 的外层炮盾使用 `Gear_Gun_Mantlet` 并挂在 `GunPivot` 下，与炮管共用源模型左右耳轴的中心；炮塔壳体固定在 `TurretPivot` 下。炮管与炮口另挂到同原点的 `RecoilPivot`，开炮后坐时外炮盾保持耳轴连接，不得随炮管整体后退。烟雾发射器从混合的 `TigerPartsA/B/C` 网格按连通组件拆为 `Gear_Turret_Smoke`，必须随炮塔旋转，其余车体附件仍留在 `Hull`。
- 共享履带材质的车体附件（例如 T-34 油桶、M24 悬挂和翼子板）使用 `Gear_Hull_TrackMaterial` 命名并挂在 `Hull` 下；只有真正的 `Tracks_` 履带网格才滚动贴图，车体附件不得参与履带 UV 动画。T-34 履带沿 V 轴滚动；Tiger I 的图集履带沿 U 轴滚动，不能共用一个固定轴向。
- 左右轮节点的局部 X 轴是轮轴，且每个节点的原点必须位于该轮子的实际几何中心；转动时轮心不得上下或前后漂移。`01–05` 是负重轮；虎式中间三组双交叉轮另拆为 `02A/B`、`03A/B`、`04A/B`，每侧共 8 个独立轮节点，不能绕双轮平均中心公转。T-34 与 Tiger I 的 `Wheel_L/R_00` 是前诱导轮、`06` 是后主动轮；M24 的真实结构相反，`00` 是前主动轮、`06` 是后诱导轮，节点记录各自真实 `rollingRadius`。各轮与履带下支内表面接触，诱导轮随端部弧形履带独立抬升，不强求所有轮底同线。相邻轮不得重叠，端轮不得穿出履带轮廓。
- 后主动轮的齿形部件随轮旋转；M24 每侧有三个托带轮，其他车型每侧两个，托带轮和悬挂都挂在 `Hull` 下，不能跟随炮塔。每个轮节点记录归一化后的实际 `rollingRadius`，敌我车辆按实际位移驱动轮轨，倒车必须反向。GLB 履带使用贴图滚动，不伪装成逐节物理履带。
- 缺少必需关节时加载失败并保留程序化坦克，不静默退回烘平层级或包围盒猜测。

程序化模型按车长安排 2–3 对负重轮，负 X 为后主动轮、正 X 为前诱导轮。履带节按周长和节长确定数量并保留间隙，托带轮接触上段内表面，负重轮接触下段内表面。`TankRig.trackLoops` 保存每侧节点和闭合路径，行驶时逐节推进；真实悬挂物理、履带刚体碰撞和差速转向物理不在当前范围内。

## 体积与性能

| 项       | 建议                                  |
| -------- | ------------------------------------- |
| GLB 大小 | ≤ 3 MB                                |
| 三角面   | ≤ 30k                                 |
| 贴图     | 原生 albedo / normal / roughness / AO |
| 压缩     | Draco 几何压缩，WebP 或 KTX2 贴图     |
| 材质     | Standard / PBR，避免自定义 shader     |

模型只在**高画质**加载，中/低画质不下载；文件走 Cache Storage 缓存，版本号由 `tankAssetVersion` 控制。Draco 解码器随站点本地部署，不依赖外部 CDN。

压缩时必须保留关节层级和 `Muzzle` 空节点。使用 gltf-transform 时关闭 `flatten`、`join`、`instance` 和会删除空节点的 `prune`；不能为了降低 draw call 合并轮子或炮塔。

## 换模型步骤

1. 用 Blender 明确上述节点、枢轴和轮轴，保留原生 UV 与材质。
2. 压缩并重新导入检查节点仍存在、GLB ≤ 3 MB，再覆盖 `apps/web/public/models/tank.glb`。
3. 修改 `apps/web/src/game/three/tank-asset.ts` 里的 `tankAssetVersion`，否则老缓存会命中旧文件。
4. 用 `?model=glb&quality=high` 验证完整外观，并实测 W/S 位移与车头方向、A/D 车体与炮塔局部姿态、轮子与履带动画、真实炮口发射；静态截图不能代替动态验收。

## 许可证

模型必须允许在本项目（公开仓库 + 线上站点）中使用。CC0 最省事；CC-BY 需要在仓库内附署名文件；**CC-BY-NC 不可用于商业站点**。
