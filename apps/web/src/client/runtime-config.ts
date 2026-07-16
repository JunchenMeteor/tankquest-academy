export type RuntimeTarget = 'web' | 'tauri-windows';
export type RuntimeEnvironment = 'development' | 'preview' | 'release';
export type RuntimeConfigIssue = 'invalid-runtime-config';

interface RuntimeEnvironmentInput {
  DEV?: boolean;
  VITE_API_URL?: string;
  VITE_DEMO_CHILD_ID?: string;
  VITE_RUNTIME_ENVIRONMENT?: string;
  VITE_RUNTIME_TARGET?: string;
}

export interface ClientConfig {
  apiBaseUrl: string;
  demoChildId: string;
  runtimeEnvironment: RuntimeEnvironment;
  runtimeTarget: RuntimeTarget;
  startupIssue: RuntimeConfigIssue | null;
}

const desktopApiOrigins: Record<RuntimeEnvironment, string> = {
  development: 'http://127.0.0.1:3000',
  preview: 'https://tq-pre.jcmeteor.com',
  release: 'https://tankquest.jcmeteor.com',
};

export function resolveClientConfig(
  env: RuntimeEnvironmentInput
): ClientConfig {
  const runtimeTarget = readRuntimeTarget(env.VITE_RUNTIME_TARGET);
  const runtimeEnvironment = readRuntimeEnvironment(
    env.VITE_RUNTIME_ENVIRONMENT,
    env.DEV
  );
  const fallbackApiUrl = env.DEV ? desktopApiOrigins.development : '';
  const apiBaseUrl = env.VITE_API_URL ?? fallbackApiUrl;
  const startupIssue =
    isKnownRuntimeTarget(env.VITE_RUNTIME_TARGET) &&
    isKnownRuntimeEnvironment(env.VITE_RUNTIME_ENVIRONMENT) &&
    validateApiBaseUrl(runtimeTarget, runtimeEnvironment, apiBaseUrl)
      ? null
      : 'invalid-runtime-config';

  return {
    apiBaseUrl,
    demoChildId: env.VITE_DEMO_CHILD_ID ?? 'child_demo',
    runtimeEnvironment,
    runtimeTarget,
    startupIssue,
  };
}

function readRuntimeTarget(value: string | undefined): RuntimeTarget {
  return value === undefined || value === 'web' ? 'web' : 'tauri-windows';
}

function isKnownRuntimeTarget(value: string | undefined) {
  return value === undefined || value === 'web' || value === 'tauri-windows';
}

function readRuntimeEnvironment(
  value: string | undefined,
  development = false
): RuntimeEnvironment {
  if (value === 'development' || value === 'preview' || value === 'release') {
    return value;
  }
  return development ? 'development' : 'release';
}

function isKnownRuntimeEnvironment(value: string | undefined) {
  return (
    value === undefined ||
    value === 'development' ||
    value === 'preview' ||
    value === 'release'
  );
}

function validateApiBaseUrl(
  target: RuntimeTarget,
  environment: RuntimeEnvironment,
  value: string
) {
  if (target === 'web' && value === '') return true;
  try {
    const url = new URL(value);
    const isOriginOnly =
      url.pathname === '/' &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash;
    if (!isOriginOnly) return false;
    if (target === 'web') {
      return (
        url.protocol === 'https:' ||
        url.origin === desktopApiOrigins.development
      );
    }
    return url.origin === desktopApiOrigins[environment];
  } catch {
    return false;
  }
}

export const clientConfig = resolveClientConfig(import.meta.env);
