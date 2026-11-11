// @vitest-environment happy-dom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { localTrainingConfig } from '../config/local-training-config.js';
import { Battle3DCanvas } from './Battle3DCanvas.js';
import type { GameInputController } from '../input/GameInputController.js';
import type { SubmitAnswerResponse } from '@tankquest/shared';

const mocks = vi.hoisted(() => ({
  handle: {
    setMode: vi.fn(),
    getMode: vi.fn(() => 'third'),
    applyAnswer: vi.fn(),
    requestPointerLock: vi.fn(() => Promise.resolve(true)),
    releasePointerLock: vi.fn(),
    dispose: vi.fn(),
  },
  createBattleView: vi.fn(),
}));
vi.mock('./battle-view.js', () => ({
  createBattleView: mocks.createBattleView,
}));

let root: Root | undefined;
let container: HTMLDivElement | undefined;

beforeEach(() => {
  mocks.handle.requestPointerLock.mockResolvedValue(true);
  mocks.createBattleView.mockReturnValue(mocks.handle);
});

afterEach(() => {
  if (root) act(() => root?.unmount());
  container?.remove();
  root = undefined;
  container = undefined;
  vi.clearAllMocks();
});

async function mount(answer?: SubmitAnswerResponse) {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await act(async () =>
    root?.render(
      <Battle3DCanvas
        config={localTrainingConfig}
        onState={vi.fn()}
        answer={answer}
      />
    )
  );
}

describe('Battle3DCanvas pointer lifecycle', () => {
  it('requests pointer lock only from the explicit button', async () => {
    await mount();
    const button = container?.querySelector('.battle-pointer-lock-toggle');
    expect(button?.textContent).toBe('Lock mouse');
    act(() =>
      button?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    );
    expect(mocks.handle.requestPointerLock).toHaveBeenCalledOnce();
  });

  it('releases lock and applies the answer when learning UI is used', async () => {
    const answer = {
      correct: true,
      resourceReward: { amount: 2 },
    } as unknown as SubmitAnswerResponse;
    await mount(answer);
    expect(mocks.handle.releasePointerLock).toHaveBeenCalled();
    expect(mocks.handle.applyAnswer).toHaveBeenCalledWith(true, 2);
  });

  it('releases lock on Escape and keyboard commands on blur', async () => {
    await mount();
    globalThis.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
    );
    expect(mocks.handle.releasePointerLock).toHaveBeenCalled();
    const input = mocks.createBattleView.mock
      .calls[0]?.[2] as GameInputController;
    globalThis.dispatchEvent(new KeyboardEvent('keydown', { key: 'w' }));
    expect(input.snapshot().forward).toBe(true);
    globalThis.dispatchEvent(new Event('blur'));
    expect(input.snapshot().forward).toBe(false);
  });

  it('disposes the view and releases its listeners on unmount', async () => {
    await mount();
    act(() => root?.unmount());
    expect(mocks.handle.dispose).toHaveBeenCalledOnce();
    root = undefined;
  });
});
