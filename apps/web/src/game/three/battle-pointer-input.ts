interface Point {
  x: number;
  y: number;
}

interface Size {
  width: number;
  height: number;
}

export interface BattlePointerCallbacks {
  aim(x: number, y: number): void;
  look(movementX: number, movementY: number): void;
  fire(pressed: boolean): void;
  right(held: boolean): void;
  reset(): void;
  lockChange(locked: boolean): void;
}

export interface BattlePointerInput {
  requestLock(): Promise<boolean>;
  release(): void;
  dispose(): void;
  isLocked(): boolean;
}

export function advanceVirtualAim(
  current: Point,
  movement: Point,
  bounds: Size
): Point {
  const currentX = Number.isFinite(current.x) ? current.x : bounds.width / 2;
  const currentY = Number.isFinite(current.y) ? current.y : bounds.height / 2;
  const movementX = Number.isFinite(movement.x) ? movement.x : 0;
  const movementY = Number.isFinite(movement.y) ? movement.y : 0;
  return {
    x: Math.max(0, Math.min(bounds.width, currentX + movementX)),
    y: Math.max(0, Math.min(bounds.height, currentY + movementY)),
  };
}

export function bindBattlePointerInput(
  canvas: HTMLCanvasElement,
  callbacks: BattlePointerCallbacks
): BattlePointerInput {
  let disposed = false;
  let rightHeld = false;
  let rightPointerId: number | null = null;
  let virtualAim = { x: Number.NaN, y: Number.NaN };

  const isLocked = () => document.pointerLockElement === canvas;
  const releaseCapture = () => {
    if (rightPointerId === null) return;
    try {
      canvas.releasePointerCapture?.(rightPointerId);
    } catch {
      /* Capture may already have been released by the browser. */
    }
    rightPointerId = null;
  };
  const clearInput = () => {
    rightHeld = false;
    releaseCapture();
    callbacks.right(false);
    callbacks.fire(false);
    callbacks.reset();
  };
  const release = () => {
    if (isLocked() && typeof document.exitPointerLock === 'function') {
      document.exitPointerLock();
    }
    clearInput();
  };
  const updateAbsoluteAim = (event: PointerEvent) => {
    const bounds = canvas.getBoundingClientRect();
    virtualAim = advanceVirtualAim(
      {
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      },
      { x: 0, y: 0 },
      bounds
    );
    callbacks.aim(virtualAim.x, virtualAim.y);
  };
  const onPointerMove = (event: PointerEvent) => {
    if (rightHeld) callbacks.look(event.movementX, event.movementY);
    if (isLocked()) {
      if (!rightHeld) {
        virtualAim = advanceVirtualAim(
          virtualAim,
          { x: event.movementX, y: event.movementY },
          canvas.getBoundingClientRect()
        );
        callbacks.aim(virtualAim.x, virtualAim.y);
      }
    } else {
      updateAbsoluteAim(event);
    }
  };
  const onPointerDown = (event: PointerEvent) => {
    if (event.button === 2) {
      rightHeld = true;
      rightPointerId = event.pointerId;
      callbacks.right(true);
      if (!isLocked()) {
        try {
          canvas.setPointerCapture?.(event.pointerId);
        } catch {
          /* The pointer may have ended before capture was requested. */
        }
      }
    }
    if (event.button === 0) {
      if (!isLocked()) updateAbsoluteAim(event);
      callbacks.fire(true);
    }
  };
  const onPointerUp = (event: PointerEvent) => {
    if (event.button === 0) callbacks.fire(false);
    if (event.button === 2) {
      rightHeld = false;
      callbacks.right(false);
      releaseCapture();
    }
  };
  const onPointerCancel = () => clearInput();
  const onLockChange = () => {
    const locked = isLocked();
    if (!locked) clearInput();
    callbacks.lockChange(locked);
  };
  const onLockError = () => {
    clearInput();
    callbacks.lockChange(false);
  };
  const onBlur = () => release();
  const onVisibilityChange = () => {
    if (document.hidden) release();
  };
  const onContextMenu = (event: Event) => event.preventDefault();

  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointercancel', onPointerCancel);
  canvas.addEventListener('lostpointercapture', onPointerCancel);
  canvas.addEventListener('contextmenu', onContextMenu);
  globalThis.addEventListener('pointerup', onPointerUp);
  globalThis.addEventListener('blur', onBlur);
  document.addEventListener('pointerlockchange', onLockChange);
  document.addEventListener('pointerlockerror', onLockError);
  document.addEventListener('visibilitychange', onVisibilityChange);

  return {
    async requestLock() {
      if (disposed || typeof canvas.requestPointerLock !== 'function') {
        return false;
      }
      try {
        await canvas.requestPointerLock();
        return true;
      } catch {
        clearInput();
        return false;
      }
    },
    release,
    dispose() {
      if (disposed) return;
      disposed = true;
      release();
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointercancel', onPointerCancel);
      canvas.removeEventListener('lostpointercapture', onPointerCancel);
      canvas.removeEventListener('contextmenu', onContextMenu);
      globalThis.removeEventListener('pointerup', onPointerUp);
      globalThis.removeEventListener('blur', onBlur);
      document.removeEventListener('pointerlockchange', onLockChange);
      document.removeEventListener('pointerlockerror', onLockError);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      callbacks.lockChange(false);
    },
    isLocked,
  };
}
