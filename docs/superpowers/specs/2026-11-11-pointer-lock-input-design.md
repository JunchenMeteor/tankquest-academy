# 战斗鼠标锁定与输入清理设计

## 目的

解决系统光标到达浏览器边缘后无法继续瞄准或旋转视角，以及窗口外松开按键、切换窗口后可能卡住开火或右键视角的问题。

## 决定

- 桌面端提供显式的“锁定鼠标”入口，由用户手势调用 Pointer Lock API，不强制全屏。
- 锁定后隐藏系统光标，使用 movementX/movementY 更新现有琥珀色虚拟准心；准心限制在画布内，物理鼠标不再受屏幕边缘限制。
- 用于进入锁定的第一次点击不得开炮；锁定后的左键才执行开火。右键视角、A/D 车体和既有双准心逻辑保留。
- Esc、答题、结算、暂停和需要操作 DOM UI 时释放锁定；恢复必须由另一次明确点击触发，不自动抢鼠标。
- 非锁定模式继续使用绝对坐标瞄准，右键拖拽使用 Pointer Capture，触控逻辑不变。
- pointerlockchange、pointerlockerror、blur、visibilitychange、pointercancel、lostpointercapture 和组件销毁都必须清理右键与开火状态；键盘在窗口失焦时也要释放。
- 修复当前全局 pointerup 匿名监听未在 dispose 中移除的问题，所有监听均可逆注册。
- Pointer Lock 不可用时保留 Pointer Capture 降级，但不能宣称降级方案也能消除屏幕边缘限制。

## 验收

- 纯函数测试覆盖虚拟准心边界、相对位移和非法数值。
- 状态测试覆盖进入锁定不射击、锁定后射击、Esc/答题释放、失焦清理、销毁移除监听和降级路径。
- 真实 Chromium 验证 document.pointerLockElement、Esc 释放、答题 UI、重新锁定、窗口失焦及窗口外松开，无卡开火或卡右键。
- 全仓质量门禁、CI、双环境同镜像部署及两轮 Playwright 对抗性复验通过。
