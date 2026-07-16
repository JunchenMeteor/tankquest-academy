import { BrowserPlatformClient } from './browser-platform-client.js';
import type { RuntimePlatform } from './platform-client.js';

export class TauriPlatformClient extends BrowserPlatformClient {
  getPlatform(): RuntimePlatform {
    return 'windows';
  }

  async registerServiceWorker() {
    return false;
  }
}
