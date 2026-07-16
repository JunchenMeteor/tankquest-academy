import { BrowserPlatformClient } from './browser-platform-client.js';
import type { PlatformClient } from './platform-client.js';

export function createPlatformClient(): PlatformClient {
  return new BrowserPlatformClient();
}

export const platformClient = createPlatformClient();
