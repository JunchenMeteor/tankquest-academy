import type { PlatformClient, RuntimePlatform } from './platform-client.js';

interface BrowserWindow {
  addEventListener(type: 'online' | 'offline', listener: () => void): void;
  removeEventListener(type: 'online' | 'offline', listener: () => void): void;
  matchMedia?(query: string): Pick<MediaQueryList, 'matches'>;
}

interface BrowserNavigator {
  onLine: boolean;
  maxTouchPoints?: number;
  getGamepads?: Navigator['getGamepads'];
  serviceWorker?: Pick<ServiceWorkerContainer, 'register'>;
}

export class BrowserPlatformClient implements PlatformClient {
  constructor(
    private readonly windowRef: BrowserWindow = globalThis.window,
    private readonly navigatorRef: BrowserNavigator = globalThis.navigator
  ) {}

  getPlatform(): RuntimePlatform {
    return 'web';
  }

  isTouchDevice() {
    return Boolean(
      (this.navigatorRef.maxTouchPoints ?? 0) > 0 ||
      this.windowRef.matchMedia?.('(pointer: coarse)').matches
    );
  }

  supportsGamepad() {
    return typeof this.navigatorRef.getGamepads === 'function';
  }

  supportsFileCache() {
    return false;
  }

  supportsNativeNotification() {
    return false;
  }

  isOnline() {
    return this.navigatorRef.onLine;
  }

  subscribeNetwork(listener: (online: boolean) => void) {
    const notify = () => listener(this.isOnline());
    this.windowRef.addEventListener('online', notify);
    this.windowRef.addEventListener('offline', notify);
    return () => {
      this.windowRef.removeEventListener('online', notify);
      this.windowRef.removeEventListener('offline', notify);
    };
  }

  async registerServiceWorker() {
    try {
      if (!this.navigatorRef.serviceWorker) return false;
      await this.navigatorRef.serviceWorker.register('/sw.js', { scope: '/' });
      return true;
    } catch {
      return false;
    }
  }
}
