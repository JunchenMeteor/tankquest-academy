import { describe, expect, it } from 'vitest';

import { resolveClientConfig } from './runtime-config.js';

describe('resolveClientConfig', () => {
  it('keeps production Web requests same-origin by default', () => {
    expect(resolveClientConfig({ DEV: false })).toMatchObject({
      apiBaseUrl: '',
      runtimeEnvironment: 'release',
      runtimeTarget: 'web',
      startupIssue: null,
    });
  });

  it.each([
    ['development', 'http://127.0.0.1:3000'],
    ['preview', 'https://tq-pre.jcmeteor.com'],
    ['release', 'https://tankquest.jcmeteor.com'],
  ] as const)(
    'accepts the %s desktop API origin',
    (environment, apiBaseUrl) => {
      expect(
        resolveClientConfig({
          DEV: false,
          VITE_API_URL: apiBaseUrl,
          VITE_RUNTIME_ENVIRONMENT: environment,
          VITE_RUNTIME_TARGET: 'tauri-windows',
        })
      ).toMatchObject({
        apiBaseUrl,
        runtimeEnvironment: environment,
        startupIssue: null,
      });
    }
  );

  it.each([
    '',
    '/api',
    'http://example.com',
    'https://tq-pre.jcmeteor.com/path',
    'https://user:secret@tq-pre.jcmeteor.com',
    'https://tq-pre.jcmeteor.com?environment=release',
  ])('rejects unsafe desktop API configuration %s', (apiBaseUrl) => {
    expect(
      resolveClientConfig({
        VITE_API_URL: apiBaseUrl,
        VITE_RUNTIME_ENVIRONMENT: 'preview',
        VITE_RUNTIME_TARGET: 'tauri-windows',
      }).startupIssue
    ).toBe('invalid-runtime-config');
  });

  it('rejects an API origin from a different desktop environment', () => {
    expect(
      resolveClientConfig({
        VITE_API_URL: 'https://tankquest.jcmeteor.com',
        VITE_RUNTIME_ENVIRONMENT: 'preview',
        VITE_RUNTIME_TARGET: 'tauri-windows',
      }).startupIssue
    ).toBe('invalid-runtime-config');
  });

  it('fails closed on unknown desktop target or environment values', () => {
    expect(
      resolveClientConfig({
        VITE_API_URL: 'https://tq-pre.jcmeteor.com',
        VITE_RUNTIME_ENVIRONMENT: 'preview',
        VITE_RUNTIME_TARGET: 'tauri-window',
      })
    ).toMatchObject({
      runtimeTarget: 'tauri-windows',
      startupIssue: 'invalid-runtime-config',
    });
    expect(
      resolveClientConfig({
        VITE_API_URL: 'https://tq-pre.jcmeteor.com',
        VITE_RUNTIME_ENVIRONMENT: 'staging',
        VITE_RUNTIME_TARGET: 'tauri-windows',
      }).startupIssue
    ).toBe('invalid-runtime-config');
  });
});
