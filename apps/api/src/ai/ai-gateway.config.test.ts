import { describe, expect, it } from 'vitest';

import { readAiGatewayConfig } from './ai-gateway.config.js';

describe('readAiGatewayConfig', () => {
  it('uses safe local defaults', () => {
    expect(readAiGatewayConfig({})).toEqual({
      baseUrl: 'http://127.0.0.1:8100',
      timeoutMs: 1_500,
    });
  });

  it('normalizes configured values', () => {
    expect(
      readAiGatewayConfig({
        AI_SERVICE_URL: 'http://ai:8100/',
        AI_SERVICE_TIMEOUT_MS: '800',
      })
    ).toEqual({ baseUrl: 'http://ai:8100', timeoutMs: 800 });
  });

  it.each([
    { AI_SERVICE_URL: 'file:///tmp/ai' },
    { AI_SERVICE_TIMEOUT_MS: '99' },
    { AI_SERVICE_TIMEOUT_MS: 'not-a-number' },
  ])('rejects invalid runtime configuration', (environment) => {
    expect(() => readAiGatewayConfig(environment)).toThrow();
  });
});
