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
      '/assets/phase4/v1/maps/range.json'
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
        manifest([asset({ preview: '/assets/phase4/v2/previews/range.svg' })])
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
