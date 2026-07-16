#!/usr/bin/env node
import { createHash } from 'node:crypto';

const origins = process.argv.slice(2).map((value) => new URL(value).origin);
if (origins.length === 0) {
  fail('Provide at least one deployment origin');
}

for (const origin of origins) {
  await verifyDeployment(origin);
  console.log(`Verified public deployment contracts: ${origin}`);
}

async function verifyDeployment(origin) {
  await expectPage(origin, '/');
  await expectPage(origin, '/parent');

  const health = await fetchJson(origin, '/api/health', 'Health endpoint');
  if (health.status !== 'ok' || health.dependencies?.ai !== 'ok') {
    fail(`API or AI dependency is not healthy: ${origin}`);
  }

  const english = await fetchJson(
    origin,
    '/api/children/child_demo/report?locale=en',
    'English parent report'
  );
  const chinese = await fetchJson(
    origin,
    '/api/children/child_demo/report?locale=zh-CN',
    'Chinese parent report'
  );
  validateParentReport(english, origin);
  validateParentReport(chinese, origin);
  const summaryFields = [
    'practiceContent',
    'progress',
    'attention',
    'nextStep',
  ];
  if (
    summaryFields.every(
      (field) => english.data.summary[field] === chinese.data.summary[field]
    )
  ) {
    fail(`English and Chinese parent summaries are identical: ${origin}`);
  }

  const manifest = await fetchJson(
    origin,
    '/manifest.webmanifest',
    'Web App Manifest'
  );
  if (
    manifest.id !== '/' ||
    manifest.start_url !== '/' ||
    manifest.scope !== '/' ||
    manifest.display !== 'standalone'
  ) {
    fail(`Web App Manifest contract is invalid: ${origin}`);
  }
  const expectedIcons = new Map([
    ['/icons/tankquest-v1-192.png', [192, 'any']],
    ['/icons/tankquest-v1-512.png', [512, 'any']],
    ['/icons/tankquest-v1-maskable-512.png', [512, 'maskable']],
  ]);
  const manifestIcons = new Map(
    (manifest.icons ?? []).map((icon) => [icon.src, icon])
  );
  for (const [iconPath, [size, purpose]] of expectedIcons) {
    const metadata = manifestIcons.get(iconPath);
    if (
      metadata?.sizes !== `${size}x${size}` ||
      metadata.type !== 'image/png' ||
      metadata.purpose !== purpose
    ) {
      fail(`Manifest icon metadata is invalid: ${iconPath}`);
    }
    const icon = await request(origin, iconPath);
    const bytes = Buffer.from(await icon.arrayBuffer());
    if (
      !(icon.headers.get('content-type') ?? '').includes('image/png') ||
      bytes.toString('ascii', 1, 4) !== 'PNG' ||
      bytes.readUInt32BE(16) !== size ||
      bytes.readUInt32BE(20) !== size
    ) {
      fail(`Manifest icon bytes are invalid: ${origin}${iconPath}`);
    }
  }

  const serviceWorker = await request(origin, '/sw.js');
  const cacheControl = serviceWorker.headers.get('cache-control') ?? '';
  for (const directive of ['no-cache', 'no-store', 'must-revalidate']) {
    if (!cacheControl.includes(directive)) {
      fail(`Service Worker cache policy is missing ${directive}: ${origin}`);
    }
  }

  const assetResponse = await fetchJson(
    origin,
    '/api/assets/manifest?levelId=level_addition_range',
    'Asset manifest'
  );
  const assetManifest = assetResponse.data;
  if (
    assetManifest?.levelId !== 'level_addition_range' ||
    !Number.isInteger(assetManifest.levelVersion) ||
    !Array.isArray(assetManifest.assets) ||
    assetManifest.assets.length === 0
  ) {
    fail(`Asset manifest contract is invalid: ${origin}`);
  }
  for (const asset of assetManifest.assets) {
    if (
      typeof asset.url !== 'string' ||
      !asset.url.startsWith('/assets/phase4/') ||
      !/^[a-f0-9]{64}$/.test(asset.sha256) ||
      !Number.isInteger(asset.sizeBytes)
    ) {
      fail(`Asset metadata is invalid: ${origin}`);
    }
    const response = await request(origin, asset.url);
    const bytes = Buffer.from(await response.arrayBuffer());
    const digest = createHash('sha256').update(bytes).digest('hex');
    if (bytes.byteLength !== asset.sizeBytes || digest !== asset.sha256) {
      fail(`Asset bytes do not match manifest: ${origin}${asset.url}`);
    }
  }
}

async function expectPage(origin, pathname) {
  const response = await request(origin, pathname);
  if (!(response.headers.get('content-type') ?? '').includes('text/html')) {
    fail(`Page did not return HTML: ${origin}${pathname}`);
  }
}

async function fetchJson(origin, pathname, label) {
  const response = await request(origin, pathname);
  try {
    return await response.json();
  } catch {
    fail(`${label} did not return valid JSON: ${origin}${pathname}`);
  }
}

async function request(origin, pathname) {
  const response = await fetch(`${origin}${pathname}`, {
    headers: { 'cache-control': 'no-cache' },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) fail(`HTTP ${response.status}: ${origin}${pathname}`);
  return response;
}

function validateParentReport(report, origin) {
  const summary = report.data?.summary;
  const fields = ['practiceContent', 'progress', 'attention', 'nextStep'];
  if (
    !summary ||
    !fields.every(
      (field) =>
        typeof summary[field] === 'string' && summary[field].trim().length > 0
    )
  ) {
    fail(`Parent report summary contract is invalid: ${origin}`);
  }
}

function fail(message) {
  throw new Error(`Public deployment verification failed: ${message}`);
}
