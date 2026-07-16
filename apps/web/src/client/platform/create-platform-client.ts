import { isTauri } from '@tauri-apps/api/core';

import { BrowserPlatformClient } from './browser-platform-client.js';
import type { PlatformClient } from './platform-client.js';
import { TauriPlatformClient } from './tauri-platform-client.js';
import { clientConfig, type RuntimeTarget } from '../runtime-config.js';

export type PlatformStartupIssue = 'bridge-unavailable' | 'runtime-mismatch';

export interface PlatformRuntime {
  client: PlatformClient;
  startupIssue: PlatformStartupIssue | null;
}

export function resolvePlatformRuntime(
  runtimeTarget: RuntimeTarget = clientConfig.runtimeTarget,
  detectTauri: () => boolean = isTauri
): PlatformRuntime {
  const tauriDetected = safelyDetectTauri(detectTauri);

  if (runtimeTarget === 'tauri-windows') {
    return {
      client: new TauriPlatformClient(),
      startupIssue: tauriDetected ? null : 'bridge-unavailable',
    };
  }
  if (tauriDetected) {
    return {
      client: new TauriPlatformClient(),
      startupIssue: 'runtime-mismatch',
    };
  }
  return { client: new BrowserPlatformClient(), startupIssue: null };
}

function safelyDetectTauri(detectTauri: () => boolean) {
  try {
    return detectTauri();
  } catch {
    return false;
  }
}

export function createPlatformClient(): PlatformClient {
  return resolvePlatformRuntime().client;
}

export const platformRuntime = resolvePlatformRuntime();
export const platformClient = platformRuntime.client;
