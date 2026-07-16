interface PlatformWindow {
  addEventListener(type: 'online' | 'offline', listener: () => void): void;
  removeEventListener(type: 'online' | 'offline', listener: () => void): void;
}

interface PlatformNavigator {
  onLine: boolean;
  serviceWorker?: Pick<ServiceWorkerContainer, 'register'>;
}

export class PlatformClient {
  constructor(
    private readonly windowRef: PlatformWindow = globalThis.window,
    private readonly navigatorRef: PlatformNavigator = globalThis.navigator
  ) {}

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

export const platformClient = new PlatformClient();
