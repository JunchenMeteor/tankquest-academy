import type { AssetManifestDto } from '@tankquest/shared';
import { describe, expect, it, vi } from 'vitest';

import { ASSET_LIMITS, AssetClient } from './asset-client.js';

const bytes = new TextEncoder().encode('{"kind":"map"}');
const validHash = 'a'.repeat(64);
const realHash =
  'dc15a839b651c0675bee56d8fbcecdd7b23fb81c40ba2e02f14fa8c21e64cf75';

function asset(
  overrides: Partial<AssetManifestDto['assets'][number]> = {}
): AssetManifestDto['assets'][number] {
  return {
    assetId: 'map_range',
    type: 'scene-description',
    version: '1.0.0',
    url: '/assets/phase4/v1/maps/range.json',
    sha256: validHash,
    sizeBytes: bytes.byteLength,
    tags: ['map'],
    preview: null,
    dependencies: [],
    ...overrides,
  };
}

function manifest(
  assets: AssetManifestDto['assets'] = [asset()]
): AssetManifestDto {
  return { levelId: 'level_1', levelVersion: 1, assets };
}

function setup(
  value: unknown = manifest(),
  response: Response = new Response(bytes, { status: 200 })
) {
  const apiClient = {
    getAssetManifest: vi.fn().mockResolvedValue(value),
  };
  const fetchAsset = vi
    .fn<typeof fetch>()
    .mockImplementation(async () => response.clone());
  const hash = vi.fn().mockResolvedValue(validHash);
  return {
    apiClient,
    fetchAsset,
    hash,
    client: new AssetClient(apiClient, { fetch: fetchAsset, hash }),
  };
}

async function expectFallback(client: AssetClient) {
  const bundle = await client.preloadLevel('level_1');
  expect(bundle).toEqual({
    source: 'fallback',
    manifest: { levelId: 'level_1', levelVersion: 0, assets: [] },
    resources: new Map(),
  });
}

describe('AssetClient', () => {
  it('validates, hashes and returns a loaded manifest bundle', async () => {
    const { client, fetchAsset, hash } = setup();

    const bundle = await client.preloadLevel('level_1');

    expect(bundle.source).toBe('manifest');
    expect(bundle.manifest).toEqual(manifest());
    expect(bundle.resources.get('map_range')).toEqual(bytes);
    expect(fetchAsset).toHaveBeenCalledWith(
      '/assets/phase4/v1/maps/range.json',
      { signal: expect.any(AbortSignal) }
    );
    expect(hash).toHaveBeenCalledWith(bytes);
  });

  it('loads dependencies before their consumers', async () => {
    const dependency = asset({
      assetId: 'palette',
      type: 'scene-description',
      url: '/assets/phase4/v1/palettes/base.json',
    });
    const dependent = asset({ dependencies: ['palette'] });
    const { client, fetchAsset } = setup(manifest([dependent, dependency]));

    await expect(client.preloadLevel('level_1')).resolves.toMatchObject({
      source: 'manifest',
    });
    expect(fetchAsset.mock.calls.map(([url]) => url)).toEqual([
      '/assets/phase4/v1/palettes/base.json',
      '/assets/phase4/v1/maps/range.json',
    ]);
  });

  it('loads supported binary resources from later Phase 4 versions', async () => {
    const texture = asset({
      assetId: 'training_base_ground_v2',
      type: 'theme-texture',
      version: '2.0.0',
      url: '/assets/phase4/v2/experience/training-base-ground-v2.webp',
    });
    const sound = asset({
      assetId: 'cannon_fire_v1',
      type: 'sound-effect',
      url: '/assets/phase4/v2/experience/cannon-fire-v1.ogg',
    });
    const { client, fetchAsset } = setup(manifest([texture, sound]));

    await expect(client.preloadLevel('level_1')).resolves.toMatchObject({
      source: 'manifest',
    });
    expect(fetchAsset.mock.calls.map(([url]) => url)).toEqual([
      texture.url,
      sound.url,
    ]);
  });

  it('loads independent resources with bounded concurrency', async () => {
    vi.useFakeTimers();
    try {
      const assets = Array.from({ length: 8 }, (_, index) =>
        asset({
          assetId: `asset_${index}`,
          url: `/assets/phase4/v2/experience/asset-${index}.ogg`,
        })
      );
      let active = 0;
      let maximumActive = 0;
      const fetchAsset = vi.fn<typeof fetch>().mockImplementation(async () => {
        active += 1;
        maximumActive = Math.max(maximumActive, active);
        await new Promise((resolve) => setTimeout(resolve, 100));
        active -= 1;
        return new Response(bytes, { status: 200 });
      });
      const client = new AssetClient(
        { getAssetManifest: vi.fn().mockResolvedValue(manifest(assets)) },
        {
          fetch: fetchAsset,
          hash: vi.fn().mockResolvedValue(validHash),
          timeoutMs: 1_000,
        }
      );

      const result = client.preloadLevel('level_1');
      await vi.advanceTimersByTimeAsync(250);

      await expect(result).resolves.toMatchObject({ source: 'manifest' });
      expect(maximumActive).toBe(4);
      expect(fetchAsset).toHaveBeenCalledTimes(8);
    } finally {
      vi.useRealTimers();
    }
  });

  it('uses browser SHA-256 when no hash adapter is provided', async () => {
    const context = setup(manifest([asset({ sha256: realHash })]));
    const client = new AssetClient(context.apiClient, {
      fetch: context.fetchAsset,
    });

    await expect(client.preloadLevel('level_1')).resolves.toMatchObject({
      source: 'manifest',
    });
  });

  it('falls back when the manifest request or an asset request fails', async () => {
    const unavailableApi = setup();
    unavailableApi.apiClient.getAssetManifest.mockRejectedValue(
      new Error('offline')
    );
    await expectFallback(unavailableApi.client);

    const missingAsset = setup(manifest(), new Response(null, { status: 404 }));
    await expectFallback(missingAsset.client);
    expect(
      missingAsset.fetchAsset.mock.calls[0]?.[1]?.signal as AbortSignal
    ).toMatchObject({ aborted: true });
  });

  it('aborts and falls back when the preload does not finish in time', async () => {
    vi.useFakeTimers();
    try {
      const getAssetManifest =
        vi.fn<
          (levelId: string, signal?: AbortSignal) => Promise<AssetManifestDto>
        >();
      getAssetManifest.mockReturnValue(
        new Promise<AssetManifestDto>(() => undefined)
      );
      const apiClient = {
        getAssetManifest,
      };
      const client = new AssetClient(apiClient, { timeoutMs: 50 });

      const result = client.preloadLevel('level_1');
      await vi.advanceTimersByTimeAsync(50);

      await expect(result).resolves.toEqual({
        source: 'fallback',
        manifest: { levelId: 'level_1', levelVersion: 0, assets: [] },
        resources: new Map(),
      });
      expect(apiClient.getAssetManifest.mock.calls[0]?.[1]?.aborted).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('falls back for malformed manifests and non-versioned URLs', async () => {
    await expectFallback(setup({ levelId: 'level_1' }).client);
    await expectFallback(
      setup({ ...manifest(), levelId: 'another_level' }).client
    );
    await expectFallback(
      setup(manifest([asset({ url: 'https://cdn.test/asset.json' })])).client
    );
    await expectFallback(
      setup(
        manifest([asset({ preview: '/assets/phase4/v0/previews/range.svg' })])
      ).client
    );
    await expectFallback(
      setup(
        manifest([asset({ url: '/assets/phase4/v1/../private/asset.json' })])
      ).client
    );
  });

  it('falls back when declared or received sizes exceed policy', async () => {
    await expectFallback(
      setup(
        manifest([
          asset({
            sizeBytes: ASSET_LIMITS.singleBytes + 1,
          }),
        ])
      ).client
    );

    const tooMany = Array.from({ length: ASSET_LIMITS.count + 1 }, (_, index) =>
      asset({
        assetId: `asset_${index}`,
        url: `/assets/phase4/v1/maps/${index}.json`,
      })
    );
    await expectFallback(setup(manifest(tooMany)).client);

    const overTotal = Array.from({ length: 9 }, (_, index) =>
      asset({
        assetId: `large_asset_${index}`,
        url: `/assets/phase4/v1/maps/large-${index}.json`,
        sizeBytes: ASSET_LIMITS.singleBytes,
      })
    );
    await expectFallback(setup(manifest(overTotal)).client);

    await expectFallback(
      setup(manifest(), new Response(new Uint8Array(bytes.byteLength + 1)))
        .client
    );
  });

  it('falls back when the content hash does not match', async () => {
    const context = setup();
    context.hash.mockResolvedValue('b'.repeat(64));
    await expectFallback(context.client);
  });

  it('falls back for missing and cyclic dependency graphs', async () => {
    await expectFallback(
      setup(manifest([asset({ dependencies: ['missing'] })])).client
    );
    await expectFallback(
      setup(
        manifest([
          asset({ assetId: 'one', dependencies: ['two'] }),
          asset({
            assetId: 'two',
            url: '/assets/phase4/v1/maps/two.json',
            dependencies: ['one'],
          }),
        ])
      ).client
    );
  });
});
