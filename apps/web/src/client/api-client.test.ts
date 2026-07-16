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

  it('loads a level asset manifest through the public query boundary', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: { levelId: 'level/one', levelVersion: 1, assets: [] },
          error: null,
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    );
    const client = new ApiClient('http://api.test', request);

    await expect(client.getAssetManifest('level/one')).resolves.toEqual({
      levelId: 'level/one',
      levelVersion: 1,
      assets: [],
    });
    expect(request).toHaveBeenCalledWith(
      'http://api.test/api/assets/manifest?levelId=level%2Fone',
      expect.any(Object)
    );
  });

  it('equips an unlocked tank skin through the child boundary', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ data: { id: 'skin_1' }, error: null }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );
    const client = new ApiClient('http://api.test', request);

    await client.equipTankSkin('child_1', 'tank_1', 'skin_1');
    expect(request).toHaveBeenCalledWith(
      'http://api.test/api/children/child_1/tanks/tank_1/skins/skin_1/equip',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('loads aggregate learning progress without answer data', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ data: [], error: null }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );
    const client = new ApiClient('http://api.test', request);

    await expect(client.listLearningProgress('child_1')).resolves.toEqual([]);
    expect(request).toHaveBeenCalledWith(
      'http://api.test/api/children/child_1/progress',
      expect.any(Object)
    );
  });

  it('loads the aggregate parent report without raw child data', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ data: { subjects: [] }, error: null }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );
    const client = new ApiClient('http://api.test', request);

    await expect(client.getParentReport('child_1', 'zh-CN')).resolves.toEqual({
      subjects: [],
    });
    expect(request).toHaveBeenCalledWith(
      'http://api.test/api/children/child_1/report?locale=zh-CN',
      expect.any(Object)
    );
  });
});
