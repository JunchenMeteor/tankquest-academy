// @vitest-environment happy-dom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ClientStartupGate,
  requiresDesktopStartupGate,
  resolveImmediateStartupFailure,
  StartupStatusCard,
} from './ClientStartupGate.js';
import { BrowserPlatformClient } from './client/platform/browser-platform-client.js';
import { TauriPlatformClient } from './client/platform/tauri-platform-client.js';
import type { ClientConfig } from './client/runtime-config.js';
import type { StartupHealthClient } from './client/startup-health-client.js';

const webConfig: ClientConfig = {
  apiBaseUrl: '',
  demoChildId: 'child_demo',
  runtimeEnvironment: 'release',
  runtimeTarget: 'web',
  startupIssue: null,
};

let root: Root | undefined;
let container: HTMLDivElement | undefined;

afterEach(() => {
  if (root) act(() => root?.unmount());
  container?.remove();
  root = undefined;
  container = undefined;
});

describe('ClientStartupGate', () => {
  it('bypasses the preflight for a normal Web runtime', () => {
    expect(
      requiresDesktopStartupGate(webConfig, {
        client: new BrowserPlatformClient(),
        startupIssue: null,
      })
    ).toBe(false);
  });

  it('fails closed for invalid Web runtime configuration', () => {
    expect(
      requiresDesktopStartupGate(
        { ...webConfig, startupIssue: 'invalid-runtime-config' },
        {
          client: new BrowserPlatformClient(),
          startupIssue: null,
        }
      )
    ).toBe(true);
  });

  it('fails closed before health checks for config, bridge, and offline issues', () => {
    const runtime = { client: new TauriPlatformClient(), startupIssue: null };
    expect(
      resolveImmediateStartupFailure(
        { ...webConfig, startupIssue: 'invalid-runtime-config' },
        runtime,
        true
      )
    ).toBe('invalid-runtime-config');
    expect(
      resolveImmediateStartupFailure(
        webConfig,
        { ...runtime, startupIssue: 'bridge-unavailable' },
        true
      )
    ).toBe('bridge-unavailable');
    expect(resolveImmediateStartupFailure(webConfig, runtime, false)).toBe(
      'offline'
    );
  });

  it('renders a stable retry state without raw diagnostics', () => {
    const html = renderToStaticMarkup(
      <StartupStatusCard
        checking={false}
        failure="api-unavailable"
        onRetry={() => undefined}
      />
    );

    expect(html).toContain('TankQuest needs a connection');
    expect(html).toContain('Try connection again');
    expect(html).not.toContain('endpoint');
  });

  it('does not offer a retry for fixed configuration or bridge failures', () => {
    const html = renderToStaticMarkup(
      <StartupStatusCard
        checking={false}
        failure="bridge-unavailable"
        onRetry={() => undefined}
      />
    );

    expect(html).not.toContain('<button');
  });

  it('bypasses health checks on Web and unlocks desktop after a healthy check', async () => {
    const healthClient = createHealthClient(true);
    const runtime = {
      client: new TauriPlatformClient(),
      startupIssue: null,
    } as const;

    await mount(
      <ClientStartupGate
        config={webConfig}
        healthClient={healthClient.client}
        runtime={{
          client: new BrowserPlatformClient(),
          startupIssue: null,
        }}
      >
        <p>Web ready</p>
      </ClientStartupGate>
    );
    expect(container?.textContent).toContain('Web ready');
    expect(healthClient.check).not.toHaveBeenCalled();

    await mount(
      <ClientStartupGate
        config={{
          ...webConfig,
          apiBaseUrl: 'https://tq-pre.jcmeteor.com',
          runtimeEnvironment: 'preview',
          runtimeTarget: 'tauri-windows',
        }}
        healthClient={healthClient.client}
        runtime={runtime}
      >
        <p>Desktop ready</p>
      </ClientStartupGate>
    );
    expect(healthClient.check).toHaveBeenCalledWith(
      'https://tq-pre.jcmeteor.com'
    );
    expect(container?.textContent).toContain('Desktop ready');
  });

  it('retries a recoverable API failure and unlocks only after success', async () => {
    const check = vi
      .fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    const healthClient = { check } as unknown as StartupHealthClient;

    await mount(
      <ClientStartupGate
        config={{
          ...webConfig,
          apiBaseUrl: 'https://tq-pre.jcmeteor.com',
          runtimeEnvironment: 'preview',
          runtimeTarget: 'tauri-windows',
        }}
        healthClient={healthClient}
        runtime={{
          client: new TauriPlatformClient(),
          startupIssue: null,
        }}
      >
        <p>Desktop ready</p>
      </ClientStartupGate>
    );
    expect(container?.textContent).not.toContain('Desktop ready');

    const retryButton = container?.querySelector('button');
    expect(retryButton).not.toBeNull();
    await act(async () => retryButton?.click());

    expect(check).toHaveBeenCalledTimes(2);
    expect(container?.textContent).toContain('Desktop ready');
  });
});

async function mount(element: React.ReactNode) {
  if (root) act(() => root?.unmount());
  container?.remove();
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root?.render(element));
}

function createHealthClient(result: boolean) {
  const check = vi.fn().mockResolvedValue(result);
  return {
    check,
    client: { check } as unknown as StartupHealthClient,
  };
}
