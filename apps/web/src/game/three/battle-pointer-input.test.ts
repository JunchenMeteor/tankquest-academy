// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  advanceVirtualAim,
  bindBattlePointerInput,
} from './battle-pointer-input.js';

function pointerEvent(
  type: string,
  init: PointerEventInit & { movementX?: number; movementY?: number } = {}
): PointerEvent {
  return new PointerEvent(type, { bubbles: true, ...init });
}

function setup() {
  const canvas = document.createElement('canvas');
  canvas.getBoundingClientRect = () =>
    ({ left: 100, top: 50, width: 800, height: 600 }) as DOMRect;
  document.body.append(canvas);
  let lockedElement: Element | null = null;
  Object.defineProperty(document, 'pointerLockElement', {
    configurable: true,
    get: () => lockedElement,
  });
  Object.defineProperty(document, 'exitPointerLock', {
    configurable: true,
    value: () => {
      lockedElement = null;
      document.dispatchEvent(new Event('pointerlockchange'));
    },
  });
  Object.defineProperty(canvas, 'requestPointerLock', {
    configurable: true,
    value: () => {
      lockedElement = canvas;
      document.dispatchEvent(new Event('pointerlockchange'));
      return Promise.resolve();
    },
  });
  const fire = vi.fn();
  const reset = vi.fn();
  const look = vi.fn();
  const aim = vi.fn();
  const right = vi.fn();
  const lockChange = vi.fn();
  const handle = bindBattlePointerInput(canvas, {
    fire,
    reset,
    look,
    aim,
    right,
    lockChange,
  });
  return { canvas, fire, reset, look, aim, right, lockChange, handle };
}

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('virtual aim', () => {
  it('applies relative movement and clamps to the canvas', () => {
    expect(
      advanceVirtualAim(
        { x: 100, y: 100 },
        { x: 30, y: -20 },
        { width: 800, height: 600 }
      )
    ).toEqual({ x: 130, y: 80 });
    expect(
      advanceVirtualAim(
        { x: 100, y: 100 },
        { x: 10000, y: -10000 },
        { width: 800, height: 600 }
      )
    ).toEqual({ x: 800, y: 0 });
    const result = advanceVirtualAim(
      { x: Number.NaN, y: Number.POSITIVE_INFINITY },
      { x: Number.NaN, y: Number.NaN },
      { width: 800, height: 600 }
    );
    expect(Number.isFinite(result.x)).toBe(true);
    expect(Number.isFinite(result.y)).toBe(true);
  });
});

describe('battle pointer input', () => {
  it('locks without firing, then fires only from a later click', async () => {
    const { canvas, fire, handle } = setup();
    await expect(handle.requestLock()).resolves.toBe(true);
    expect(handle.isLocked()).toBe(true);
    expect(fire).not.toHaveBeenCalled();

    canvas.dispatchEvent(pointerEvent('pointerdown', { button: 0 }));
    expect(fire).toHaveBeenCalledWith(true);
    globalThis.dispatchEvent(pointerEvent('pointerup', { button: 0 }));
    expect(fire).toHaveBeenCalledWith(false);
    handle.dispose();
  });

  it('uses pointer capture for unlocked right-drag and relative look while locked', async () => {
    const { canvas, look, right, handle } = setup();
    const capture = vi.spyOn(canvas, 'setPointerCapture');
    canvas.dispatchEvent(
      pointerEvent('pointerdown', { button: 2, pointerId: 7 })
    );
    expect(capture).toHaveBeenCalledWith(7);
    expect(right).toHaveBeenCalledWith(true);
    canvas.dispatchEvent(
      pointerEvent('pointermove', { movementX: 20, movementY: -5 })
    );
    expect(look).toHaveBeenCalledWith(20, -5);

    await handle.requestLock();
    canvas.dispatchEvent(
      pointerEvent('pointermove', { movementX: 12, movementY: 4 })
    );
    expect(look).toHaveBeenCalledWith(12, 4);
    globalThis.dispatchEvent(pointerEvent('pointerup', { button: 2 }));
    expect(right).toHaveBeenCalledWith(false);
    handle.dispose();
  });

  it('releases pointer lock and every input on window blur', async () => {
    const { canvas, fire, reset, right, handle } = setup();
    await handle.requestLock();
    canvas.dispatchEvent(pointerEvent('pointerdown', { button: 0 }));
    canvas.dispatchEvent(pointerEvent('pointerdown', { button: 2 }));
    globalThis.dispatchEvent(new Event('blur'));
    expect(handle.isLocked()).toBe(false);
    expect(document.pointerLockElement).toBeNull();
    expect(fire).toHaveBeenCalledWith(false);
    expect(right).toHaveBeenCalledWith(false);
    expect(reset).toHaveBeenCalled();
    handle.dispose();
  });

  it('keeps absolute aim and capture available when pointer lock is rejected', async () => {
    const { canvas, aim, fire, handle } = setup();
    Object.defineProperty(canvas, 'requestPointerLock', {
      configurable: true,
      value: () => Promise.reject(new Error('denied')),
    });
    await expect(handle.requestLock()).resolves.toBe(false);
    canvas.dispatchEvent(
      pointerEvent('pointerdown', {
        button: 0,
        clientX: 350,
        clientY: 250,
      })
    );
    expect(aim).toHaveBeenCalledWith(250, 200);
    expect(fire).toHaveBeenCalledWith(true);
    handle.dispose();
  });

  it('removes global listeners and clears input on dispose', () => {
    const { canvas, fire, reset, handle } = setup();
    canvas.dispatchEvent(pointerEvent('pointerdown', { button: 0 }));
    handle.dispose();
    expect(fire).toHaveBeenCalledWith(false);
    expect(reset).toHaveBeenCalled();
    fire.mockClear();
    globalThis.dispatchEvent(pointerEvent('pointerup', { button: 0 }));
    canvas.dispatchEvent(pointerEvent('pointerdown', { button: 0 }));
    expect(fire).not.toHaveBeenCalled();
  });
});
