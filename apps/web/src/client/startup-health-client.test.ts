import { describe, expect, it, vi } from 'vitest';

import { StartupHealthClient } from './startup-health-client.js';

describe('StartupHealthClient', () => {
  it('accepts only an ok health response', async () => {
    const fetchRef = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: 'ok' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      })
    );

    await expect(
      new StartupHealthClient(fetchRef).check('https://tq-pre.jcmeteor.com')
    ).resolves.toBe(true);
    expect(fetchRef).toHaveBeenCalledWith(
      'https://tq-pre.jcmeteor.com/api/health',
      expect.objectContaining({ cache: 'no-store' })
    );
  });

  it.each([
    new Response('{}', { status: 503 }),
    new Response(JSON.stringify({ status: 'degraded' }), { status: 200 }),
  ])('rejects an unhealthy response', async (response) => {
    const fetchRef = vi.fn().mockResolvedValue(response);
    await expect(
      new StartupHealthClient(fetchRef).check('https://example.com')
    ).resolves.toBe(false);
  });

  it('fails quietly on invalid JSON or network errors', async () => {
    const invalidJson = vi
      .fn()
      .mockResolvedValue(new Response('{', { status: 200 }));
    const networkError = vi
      .fn()
      .mockRejectedValue(new Error('secret endpoint detail'));

    await expect(
      new StartupHealthClient(invalidJson).check('https://example.com')
    ).resolves.toBe(false);
    await expect(
      new StartupHealthClient(networkError).check('https://example.com')
    ).resolves.toBe(false);
  });

  it('aborts a health check that exceeds the startup timeout', async () => {
    vi.useFakeTimers();
    const fetchRef = vi.fn(
      (_url: string | URL | Request, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError'))
          );
        })
    );

    try {
      const result = new StartupHealthClient(fetchRef, 50).check(
        'https://example.com'
      );
      await vi.advanceTimersByTimeAsync(50);
      await expect(result).resolves.toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});
