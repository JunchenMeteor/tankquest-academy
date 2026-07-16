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

const ASSET_PATH_PREFIX = '/assets/phase4/v1/';

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
}

export class AssetClient {
  private readonly fetchAsset: AssetFetcher;
  private readonly hashAsset: AssetHasher;

  constructor(
    private readonly apiClient: ManifestClient,
    dependencies: AssetClientDependencies = {}
  ) {
    this.fetchAsset = (dependencies.fetch ?? globalThis.fetch).bind(globalThis);
    this.hashAsset = dependencies.hash ?? sha256;
  }

  async preloadLevel(levelId: string): Promise<AssetBundle> {
    try {
      const manifest = assetManifestSchema.parse(
        await this.apiClient.getAssetManifest(levelId)
      );
      if (manifest.levelId !== levelId) {
        throw new Error('Asset manifest level mismatch');
      }
      const orderedAssets = validateManifest(manifest);
      const resources = new Map<string, Uint8Array>();

      for (const asset of orderedAssets) {
        const response = await this.fetchAsset(asset.url);
        if (!response.ok) {
          throw new Error('Asset request failed');
        }
        const bytes = await readExactBytes(response, asset.sizeBytes);
        const digest = (await this.hashAsset(bytes)).toLowerCase();
        if (digest !== asset.sha256.toLowerCase()) {
          throw new Error('Asset hash mismatch');
        }
        resources.set(asset.assetId, bytes);
      }

      return { source: 'manifest', manifest, resources };
    } catch {
      return fallbackBundle(levelId);
    }
  }
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
    !value.startsWith(ASSET_PATH_PREFIX) ||
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
