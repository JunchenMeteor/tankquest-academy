import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rename, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  createManifest,
  readManifest,
  validateManifest,
  verifyWheelhouse,
} from './ai-wheelhouse-manifest.mjs';

async function fixture(name) {
  const root = await mkdtemp(
    path.join(tmpdir(), `tankquest-wheelhouse-${name}-`)
  );
  const wheelhouse = path.join(root, 'wheelhouse');
  const manifest = path.join(root, 'manifest.json');
  await mkdir(wheelhouse);
  await writeFile(path.join(wheelhouse, 'alpha-1.0-py3-none-any.whl'), 'alpha');
  await writeFile(path.join(wheelhouse, 'beta-2.0.tar.gz'), 'beta');
  return { root, wheelhouse, manifest };
}

const valid = await fixture('valid');
const created = await createManifest(valid.wheelhouse, valid.manifest);
assert.equal(
  await verifyWheelhouse(valid.wheelhouse, valid.manifest),
  created.contentKey
);
assert.deepEqual(await readManifest(valid.manifest), created);

const deterministicManifest = path.join(valid.root, 'manifest-copy.json');
assert.equal(
  (await createManifest(valid.wheelhouse, deterministicManifest)).contentKey,
  created.contentKey
);

const tampered = await fixture('tampered');
await createManifest(tampered.wheelhouse, tampered.manifest);
await writeFile(
  path.join(tampered.wheelhouse, 'alpha-1.0-py3-none-any.whl'),
  'omega'
);
await assert.rejects(
  () => verifyWheelhouse(tampered.wheelhouse, tampered.manifest),
  /SHA-256 mismatch/u
);

const missing = await fixture('missing');
await createManifest(missing.wheelhouse, missing.manifest);
await rename(
  path.join(missing.wheelhouse, 'beta-2.0.tar.gz'),
  path.join(missing.root, 'beta-2.0.tar.gz')
);
await assert.rejects(
  () => verifyWheelhouse(missing.wheelhouse, missing.manifest),
  /do not exactly match/u
);

const extra = await fixture('extra');
await createManifest(extra.wheelhouse, extra.manifest);
await writeFile(path.join(extra.wheelhouse, 'extra.whl'), 'extra');
await assert.rejects(
  () => verifyWheelhouse(extra.wheelhouse, extra.manifest),
  /do not exactly match/u
);

assert.throws(
  () =>
    validateManifest({
      ...created,
      files: [{ ...created.files[0], name: '../escape.whl' }, created.files[1]],
    }),
  /unsafe file name/u
);
assert.throws(
  () => validateManifest({ ...created, contentKey: '0'.repeat(64) }),
  /content key/u
);

console.log(
  'Verified deterministic, strict AI wheelhouse manifests and content keys.'
);
