import { useEffect, useState } from 'react';

import {
  platformRuntime,
  type PlatformRuntime,
} from './client/platform/create-platform-client.js';
import {
  clientConfig,
  type ClientConfig,
  type RuntimeConfigIssue,
} from './client/runtime-config.js';
import { StartupHealthClient } from './client/startup-health-client.js';
import { useI18n } from './i18n/I18nProvider.js';

type StartupFailure =
  | RuntimeConfigIssue
  | 'bridge-unavailable'
  | 'runtime-mismatch'
  | 'offline'
  | 'api-unavailable';

interface ClientStartupGateProps {
  children: React.ReactNode;
  config?: ClientConfig;
  healthClient?: StartupHealthClient;
  runtime?: PlatformRuntime;
}

const defaultHealthClient = new StartupHealthClient();

export function ClientStartupGate({
  children,
  config = clientConfig,
  healthClient = defaultHealthClient,
  runtime = platformRuntime,
}: ClientStartupGateProps) {
  const requiresGate = requiresDesktopStartupGate(config, runtime);
  const [online, setOnline] = useState(() => runtime.client.isOnline());
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<'checking' | 'failed' | 'ready'>(() =>
    requiresGate ? 'checking' : 'ready'
  );
  const immediateFailure = resolveImmediateStartupFailure(
    config,
    runtime,
    online
  );

  useEffect(() => runtime.client.subscribeNetwork(setOnline), [runtime]);

  useEffect(() => {
    if (!requiresGate) {
      setStatus('ready');
      return;
    }
    if (immediateFailure) {
      setStatus('failed');
      return;
    }

    let active = true;
    setStatus('checking');
    void healthClient.check(config.apiBaseUrl).then((healthy) => {
      if (active) setStatus(healthy ? 'ready' : 'failed');
    });
    return () => {
      active = false;
    };
  }, [attempt, config, healthClient, immediateFailure, requiresGate]);

  if (!requiresGate || status === 'ready') return children;

  return (
    <StartupStatusCard
      checking={status === 'checking'}
      failure={immediateFailure ?? 'api-unavailable'}
      onRetry={() => setAttempt((current) => current + 1)}
    />
  );
}

export function requiresDesktopStartupGate(
  config: ClientConfig,
  runtime: PlatformRuntime
) {
  return (
    config.startupIssue !== null ||
    runtime.startupIssue !== null ||
    config.runtimeTarget === 'tauri-windows' ||
    runtime.client.getPlatform() === 'windows'
  );
}

export function resolveImmediateStartupFailure(
  config: ClientConfig,
  runtime: PlatformRuntime,
  online: boolean
): StartupFailure | null {
  return (
    config.startupIssue ?? runtime.startupIssue ?? (online ? null : 'offline')
  );
}

export function StartupStatusCard({
  checking,
  failure,
  onRetry,
}: {
  checking: boolean;
  failure: StartupFailure;
  onRetry: () => void;
}) {
  const { t } = useI18n();
  const messageKey =
    failure === 'offline'
      ? 'desktop.startup.offline'
      : failure === 'api-unavailable'
        ? 'desktop.startup.apiUnavailable'
        : failure === 'invalid-runtime-config'
          ? 'desktop.startup.invalidConfig'
          : 'desktop.startup.bridgeUnavailable';

  return (
    <main className="app-shell">
      <section className="status-card" aria-live="polite">
        <h1>{t('desktop.startup.title')}</h1>
        <p>{checking ? t('desktop.startup.checking') : t(messageKey)}</p>
        {!checking && failure === 'api-unavailable' && (
          <button type="button" onClick={onRetry}>
            {t('desktop.startup.retry')}
          </button>
        )}
      </section>
    </main>
  );
}
