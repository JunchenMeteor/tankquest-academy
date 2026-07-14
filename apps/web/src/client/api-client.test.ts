import { describe, expect, it, vi } from 'vitest';

import { ApiClient, ApiClientError } from './api-client.js';

describe('ApiClient', () => {
  it('unwraps successful response envelopes', async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ data: [{ id: 'level_1' }], error: null }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      );
    const client = new ApiClient('http://api.test', request);

    await expect(client.listLevels()).resolves.toEqual([{ id: 'level_1' }]);
    expect(request).toHaveBeenCalledWith(
      'http://api.test/api/levels',
      expect.objectContaining({
        headers: { 'content-type': 'application/json' },
      })
    );
  });

  it('turns rejected responses into a stable client error', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ message: 'Not enough parts' }), {
        status: 409,
        headers: { 'content-type': 'application/json' },
      })
    );
    const client = new ApiClient('http://api.test', request);

    await expect(
      client.upgradeTank('child_1', 'tank_1', 'firepower')
    ).rejects.toEqual(new ApiClientError('Not enough parts', 409));
  });

  it('loads the child-owned tank collection', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ data: [], error: null }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );
    const client = new ApiClient('http://api.test', request);

    await expect(client.listOwnedTanks('child_1')).resolves.toEqual([]);
    expect(request).toHaveBeenCalledWith(
      'http://api.test/api/children/child_1/tanks',
      expect.any(Object)
    );
  });
});
