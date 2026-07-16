import { describe, expect, it, vi } from 'vitest';

import { PlatformClient } from './platform-client.js';

describe('PlatformClient', () => {
  it('reports network changes without owning application state', () => {
    let online = true;
    const listeners = new Map<string, () => void>();
    const windowRef = {
      addEventListener: (type: string, listener: () => void) =>
        listeners.set(type, listener),
      removeEventListener: (type: string) => listeners.delete(type),
    };
    const navigatorRef = {
      get onLine() {
        return online;
      },
    };
    const client = new PlatformClient(windowRef, navigatorRef);
    const listener = vi.fn();
    const unsubscribe = client.subscribeNetwork(listener);

    online = false;
    listeners.get('offline')?.();
    expect(listener).toHaveBeenCalledWith(false);
    unsubscribe();
    expect(listeners.size).toBe(0);
  });

  it('registers the fixed same-origin Service Worker and fails quietly', async () => {
    const register = vi.fn().mockResolvedValue({});
    const client = new PlatformClient(
      { addEventListener: vi.fn(), removeEventListener: vi.fn() },
      { onLine: true, serviceWorker: { register } }
    );

    await expect(client.registerServiceWorker()).resolves.toBe(true);
    expect(register).toHaveBeenCalledWith('/sw.js', { scope: '/' });

    register.mockRejectedValue(new Error('disabled'));
    await expect(client.registerServiceWorker()).resolves.toBe(false);
  });
});
