import { describe, expect, it, vi } from 'vitest';

import { warmGameRuntime } from './load-game-runtime.js';

describe('game runtime warmup', () => {
  it('preloads the lazy runtime and contains transient failures', async () => {
    const available = vi.fn().mockResolvedValue({ createGame: vi.fn() });
    const unavailable = vi.fn().mockRejectedValue(new Error('stale chunk'));

    await expect(warmGameRuntime(available)).resolves.toBe(true);
    await expect(warmGameRuntime(unavailable)).resolves.toBe(false);
    expect(available).toHaveBeenCalledOnce();
    expect(unavailable).toHaveBeenCalledOnce();
  });
});
