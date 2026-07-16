import { describe, expect, it, vi } from 'vitest';

import { BrowserPlatformClient } from './browser-platform-client.js';
import { createPlatformClient } from './create-platform-client.js';

describe('BrowserPlatformClient', () => {
  it('declares browser platform capabilities without native privileges', () => {
    const client = new BrowserPlatformClient(
      {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        matchMedia: () => ({ matches: false }),
      },
      { onLine: true, maxTouchPoints: 0, getGamepads: vi.fn() }
    );

    expect(client.getPlatform()).toBe('web');
    expect(client.isTouchDevice()).toBe(false);
    expect(client.supportsGamepad()).toBe(true);
    expect(client.supportsFileCache()).toBe(false);
    expect(client.supportsNativeNotification()).toBe(false);
  });

  it('detects touch input without changing the runtime platform', () => {
    const client = new BrowserPlatformClient(
      { addEventListener: vi.fn(), removeEventListener: vi.fn() },
      { onLine: true, maxTouchPoints: 1 }
    );

    expect(client.getPlatform()).toBe('web');
    expect(client.isTouchDevice()).toBe(true);
  });

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
    const client = new BrowserPlatformClient(windowRef, navigatorRef);
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
    const client = new BrowserPlatformClient(
      { addEventListener: vi.fn(), removeEventListener: vi.fn() },
      { onLine: true, serviceWorker: { register } }
    );

    await expect(client.registerServiceWorker()).resolves.toBe(true);
    expect(register).toHaveBeenCalledWith('/sw.js', { scope: '/' });

    register.mockRejectedValue(new Error('disabled'));
    await expect(client.registerServiceWorker()).resolves.toBe(false);
  });

  it('returns false when Service Workers are unavailable', async () => {
    const client = new BrowserPlatformClient(
      { addEventListener: vi.fn(), removeEventListener: vi.fn() },
      { onLine: true }
    );

    await expect(client.registerServiceWorker()).resolves.toBe(false);
  });

  it('is selected by the default platform factory', () => {
    expect(createPlatformClient()).toBeInstanceOf(BrowserPlatformClient);
  });
});
