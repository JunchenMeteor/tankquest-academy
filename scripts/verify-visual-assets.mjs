import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const publicRoot = resolve(repositoryRoot, 'apps/web/public');
const catalogPath = resolve(
  repositoryRoot,
  'apps/api/prisma/asset-catalog.json'
);
const allowedKeys = new Set([
  'id',
  'type',
  'version',
  'url',
  'sha256',
  'sizeBytes',
  'tags',
  'preview',
  'dependencies',
]);

function fail(message) {
  throw new Error(`Visual asset verification failed: ${message}`);
}

function resolvePublicAsset(url) {
  if (
    !/^\/assets\/phase4\/v[1-9]\d*\/(?:[a-z0-9][a-z0-9._-]*\/)*[a-z0-9][a-z0-9._-]*$/.test(
      url
    )
  ) {
    fail(`invalid versioned same-origin URL ${url}`);
  }
  const path = resolve(publicRoot, `.${url}`);
  if (!path.startsWith(`${publicRoot}${sep}`)) fail(`unsafe asset URL ${url}`);
  return path;
}

function verifyDependencies(assets) {
  const byId = new Map(assets.map((asset) => [asset.id, asset]));
  if (byId.size !== assets.length) fail('asset IDs must be unique');
  if (new Set(assets.map((asset) => asset.url)).size !== assets.length) {
    fail('asset URLs must be unique');
  }

  const visited = new Set();
  const visiting = new Set();
  const visit = (assetId) => {
    if (visited.has(assetId)) return;
    if (visiting.has(assetId)) fail(`cyclic dependency at ${assetId}`);
    const asset = byId.get(assetId);
    if (!asset) fail(`missing dependency ${assetId}`);
    visiting.add(assetId);
    for (const dependency of asset.dependencies) visit(dependency);
    visiting.delete(assetId);
    visited.add(assetId);
  };
  for (const asset of assets) visit(asset.id);
}

async function main() {
  const catalog = JSON.parse(await readFile(catalogPath, 'utf8'));
  if (!Array.isArray(catalog) || catalog.length === 0) {
    fail('asset catalog must be a non-empty array');
  }

  for (const asset of catalog) {
    const missingKeys = [...allowedKeys].filter((key) => !(key in asset));
    const extraKeys = Object.keys(asset).filter((key) => !allowedKeys.has(key));
    if (missingKeys.length > 0) fail(`${asset.id ?? 'unknown'} is incomplete`);
    if (extraKeys.length > 0) fail(`${asset.id ?? 'unknown'} has extra fields`);
    if (
      typeof asset.id !== 'string' ||
      !['scene-description', 'tank-visuals'].includes(asset.type) ||
      !/^\d+\.\d+\.\d+$/.test(asset.version) ||
      !/^[a-f0-9]{64}$/.test(asset.sha256) ||
      !Number.isInteger(asset.sizeBytes) ||
      asset.sizeBytes <= 0 ||
      !Array.isArray(asset.tags) ||
      !Array.isArray(asset.dependencies) ||
      (asset.preview !== null && typeof asset.preview !== 'string')
    ) {
      fail(`${asset.id ?? 'unknown'} has invalid metadata`);
    }
    if (
      new Set(asset.tags).size !== asset.tags.length ||
      new Set(asset.dependencies).size !== asset.dependencies.length
    ) {
      fail(`${asset.id} has duplicate tags or dependencies`);
    }

    const bytes = await readFile(resolvePublicAsset(asset.url));
    const actualSha256 = createHash('sha256').update(bytes).digest('hex');
    if (bytes.byteLength !== asset.sizeBytes) {
      fail(
        `${asset.id} size is ${bytes.byteLength}, expected ${asset.sizeBytes}`
      );
    }
    if (actualSha256 !== asset.sha256) {
      fail(`${asset.id} SHA-256 is ${actualSha256}, expected ${asset.sha256}`);
    }
    JSON.parse(bytes.toString('utf8'));

    if (asset.preview !== null) {
      await readFile(resolvePublicAsset(asset.preview));
    }
  }

  verifyDependencies(catalog);
  console.log(`Verified ${catalog.length} versioned visual assets.`);
}

await main();
