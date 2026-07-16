import { describe, expect, it, vi } from 'vitest';

import { BrowserPlatformClient } from './browser-platform-client.js';
import {
  createPlatformClient,
  resolvePlatformRuntime,
} from './create-platform-client.js';
import { TauriPlatformClient } from './tauri-platform-client.js';

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

  it('selects the Tauri adapter only when target and bridge agree', () => {
    const runtime = resolvePlatformRuntime('tauri-windows', () => true);

    expect(runtime.client).toBeInstanceOf(TauriPlatformClient);
    expect(runtime.client.getPlatform()).toBe('windows');
    expect(runtime.startupIssue).toBeNull();
  });

  it('fails closed when a desktop build has no Tauri bridge', () => {
    const runtime = resolvePlatformRuntime('tauri-windows', () => false);

    expect(runtime.client).toBeInstanceOf(TauriPlatformClient);
    expect(runtime.startupIssue).toBe('bridge-unavailable');
  });

  it('fails closed when Tauri loads a Web-target build', () => {
    const runtime = resolvePlatformRuntime('web', () => true);

    expect(runtime.client).toBeInstanceOf(TauriPlatformClient);
    expect(runtime.startupIssue).toBe('runtime-mismatch');
  });

  it('uses the browser adapter when target and runtime are Web', () => {
    const runtime = resolvePlatformRuntime('web', () => false);

    expect(runtime.client).toBeInstanceOf(BrowserPlatformClient);
    expect(runtime.startupIssue).toBeNull();
  });

  it('never registers a Service Worker inside Tauri', async () => {
    const register = vi.fn();
    const client = new TauriPlatformClient(
      { addEventListener: vi.fn(), removeEventListener: vi.fn() },
      { onLine: true, serviceWorker: { register } }
    );

    await expect(client.registerServiceWorker()).resolves.toBe(false);
    expect(register).not.toHaveBeenCalled();
  });
});
