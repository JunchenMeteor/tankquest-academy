import {
  assetManifestMaxAssets,
  assetManifestMaxSizeBytes,
  assetManifestSchema,
  assetMaxSizeBytes,
  type AssetManifestDto,
} from '@tankquest/shared';

import type { ApiClient } from '../api-client.js';

export const ASSET_LIMITS = {
  count: assetManifestMaxAssets,
  singleBytes: assetMaxSizeBytes,
  totalBytes: assetManifestMaxSizeBytes,
} as const;

const ASSET_PATH_PATTERN = /^\/assets\/phase4\/v[1-9]\d*\//;
const DEFAULT_PRELOAD_TIMEOUT_MS = 5_000;
const ASSET_FETCH_CONCURRENCY = 4;

export interface AssetBundle {
  source: 'manifest' | 'fallback';
  manifest: AssetManifestDto;
  resources: Map<string, Uint8Array>;
}

type ManifestClient = Pick<ApiClient, 'getAssetManifest'>;
type AssetFetcher = typeof fetch;
type AssetHasher = (bytes: Uint8Array) => Promise<string>;

export interface AssetClientDependencies {
  fetch?: AssetFetcher;
  hash?: AssetHasher;
  timeoutMs?: number;
}

export class AssetClient {
  private readonly fetchAsset: AssetFetcher;
  private readonly hashAsset: AssetHasher;
  private readonly timeoutMs: number;

  constructor(
    private readonly apiClient: ManifestClient,
    dependencies: AssetClientDependencies = {}
  ) {
    this.fetchAsset = (dependencies.fetch ?? globalThis.fetch).bind(globalThis);
    this.hashAsset = dependencies.hash ?? sha256;
    this.timeoutMs = dependencies.timeoutMs ?? DEFAULT_PRELOAD_TIMEOUT_MS;
  }

  async preloadLevel(levelId: string): Promise<AssetBundle> {
    const controller = new AbortController();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const load = this.loadLevel(levelId, controller.signal);
      const timedOut = new Promise<never>((_, reject) => {
        timeout = setTimeout(() => {
          controller.abort();
          reject(new Error('Asset preload timed out'));
        }, this.timeoutMs);
      });
      return await Promise.race([load, timedOut]);
    } catch {
      controller.abort();
      return fallbackBundle(levelId);
    } finally {
      if (timeout !== undefined) clearTimeout(timeout);
    }
  }

  private async loadLevel(
    levelId: string,
    signal: AbortSignal
  ): Promise<AssetBundle> {
    const manifest = assetManifestSchema.parse(
      await this.apiClient.getAssetManifest(levelId, signal)
    );
    if (manifest.levelId !== levelId) {
      throw new Error('Asset manifest level mismatch');
    }
    const orderedAssets = validateManifest(manifest);
    const loadedAssets = await mapWithConcurrency(
      orderedAssets,
      ASSET_FETCH_CONCURRENCY,
      async (asset) => {
        const response = await this.fetchAsset(asset.url, { signal });
        if (!response.ok) {
          throw new Error('Asset request failed');
        }
        const bytes = await readExactBytes(response, asset.sizeBytes);
        const digest = (await this.hashAsset(bytes)).toLowerCase();
        if (digest !== asset.sha256.toLowerCase()) {
          throw new Error('Asset hash mismatch');
        }
        return [asset.assetId, bytes] as const;
      }
    );
    const resources = new Map(loadedAssets);

    return { source: 'manifest', manifest, resources };
  }
}

async function mapWithConcurrency<T, R>(
  values: readonly T[],
  concurrency: number,
  mapValue: (value: T) => Promise<R>
) {
  const results = new Array<R>(values.length);
  let nextIndex = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, values.length) },
    async () => {
      while (nextIndex < values.length) {
        const index = nextIndex;
        nextIndex += 1;
        results[index] = await mapValue(values[index] as T);
      }
    }
  );
  await Promise.all(workers);
  return results;
}

function validateManifest(manifest: AssetManifestDto) {
  if (manifest.assets.length > ASSET_LIMITS.count) {
    throw new Error('Asset count limit exceeded');
  }

  const assetsById = new Map(
    manifest.assets.map((asset) => [asset.assetId, asset] as const)
  );
  if (assetsById.size !== manifest.assets.length) {
    throw new Error('Duplicate asset id');
  }

  let totalBytes = 0;
  for (const asset of manifest.assets) {
    if (!isAllowedAssetUrl(asset.url)) {
      throw new Error('Asset URL is outside the versioned path');
    }
    if (asset.preview !== null && !isAllowedAssetUrl(asset.preview)) {
      throw new Error('Asset preview is outside the versioned path');
    }
    if (asset.sizeBytes > ASSET_LIMITS.singleBytes) {
      throw new Error('Asset size limit exceeded');
    }
    totalBytes += asset.sizeBytes;
  }
  if (totalBytes > ASSET_LIMITS.totalBytes) {
    throw new Error('Asset bundle size limit exceeded');
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const ordered: AssetManifestDto['assets'] = [];
  const visit = (assetId: string) => {
    if (visiting.has(assetId)) {
      throw new Error('Asset dependency cycle');
    }
    if (visited.has(assetId)) return;

    const asset = assetsById.get(assetId);
    if (!asset) {
      throw new Error('Asset dependency is missing');
    }
    visiting.add(assetId);
    for (const dependencyId of asset.dependencies) visit(dependencyId);
    visiting.delete(assetId);
    visited.add(assetId);
    ordered.push(asset);
  };

  for (const asset of manifest.assets) visit(asset.assetId);
  return ordered;
}

function isAllowedAssetUrl(value: string) {
  if (
    !ASSET_PATH_PATTERN.test(value) ||
    value.includes('?') ||
    value.includes('#')
  ) {
    return false;
  }
  try {
    const parsed = new URL(value, 'https://tankquest.invalid');
    return (
      parsed.origin === 'https://tankquest.invalid' && parsed.pathname === value
    );
  } catch {
    return false;
  }
}

async function readExactBytes(response: Response, expectedBytes: number) {
  const contentLength = response.headers.get('content-length');
  if (contentLength !== null && Number(contentLength) !== expectedBytes) {
    throw new Error('Asset byte size mismatch');
  }

  if (!response.body) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength !== expectedBytes) {
      throw new Error('Asset byte size mismatch');
    }
    return bytes;
  }

  const reader = response.body.getReader();
  const bytes = new Uint8Array(expectedBytes);
  let offset = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (offset + value.byteLength > expectedBytes) {
        void reader.cancel();
        throw new Error('Asset byte size mismatch');
      }
      bytes.set(value, offset);
      offset += value.byteLength;
    }
  } finally {
    reader.releaseLock();
  }

  if (offset !== expectedBytes) {
    throw new Error('Asset byte size mismatch');
  }
  return bytes;
}

async function sha256(bytes: Uint8Array) {
  const digest = await globalThis.crypto.subtle.digest(
    'SHA-256',
    Uint8Array.from(bytes)
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0')
  ).join('');
}

function fallbackBundle(levelId: string): AssetBundle {
  return {
    source: 'fallback',
    manifest: { levelId, levelVersion: 0, assets: [] },
    resources: new Map(),
  };
}
