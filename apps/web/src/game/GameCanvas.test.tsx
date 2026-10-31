// @vitest-environment happy-dom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { localTrainingConfig } from './config/local-training-config.js';
import { GameCanvas } from './GameCanvas.js';

let root: Root | undefined;
let container: HTMLDivElement | undefined;

afterEach(() => {
  if (root) act(() => root?.unmount());
  container?.remove();
  root = undefined;
  container = undefined;
});

describe('GameCanvas', () => {
  it('offers a localized reload action when the lazy runtime is stale', async () => {
    const reload = vi.fn();
    await mount(
      <GameCanvas
        config={localTrainingConfig}
        loadRuntime={vi.fn().mockRejectedValue(new Error('stale chunk'))}
        onReload={reload}
        onState={vi.fn()}
      />
    );

    const alert = container?.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('game update could not load');
    const button = alert?.querySelector('button');
    expect(button?.textContent).toBe('Refresh game');
    act(() => button?.click());
    expect(reload).toHaveBeenCalledOnce();
  });
});

async function mount(element: React.ReactNode) {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root?.render(element));
}
