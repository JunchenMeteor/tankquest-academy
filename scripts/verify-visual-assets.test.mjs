import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import test from 'node:test';

import { verifyAssetBytes } from './verify-visual-assets.mjs';

function asset(type, extension) {
  return {
    id: `asset_${type}`,
    type,
    url: `/assets/phase4/v2/experience/resource.${extension}`,
  };
}

test('accepts JSON, WebP and Ogg resource signatures', () => {
  assert.doesNotThrow(() =>
    verifyAssetBytes(
      asset('scene-description', 'json'),
      Buffer.from('{"schemaVersion":1}')
    )
  );
  assert.doesNotThrow(() =>
    verifyAssetBytes(
      asset('theme-texture', 'webp'),
      Buffer.from('RIFF\0\0\0\0WEBP')
    )
  );
  assert.doesNotThrow(() =>
    verifyAssetBytes(asset('sound-effect', 'ogg'), Buffer.from('OggS'))
  );
});

test('rejects payloads whose extension or signature does not match the type', () => {
  assert.throws(
    () =>
      verifyAssetBytes(
        asset('scene-description', 'json'),
        Buffer.from('{broken')
      ),
    /not valid JSON/u
  );
  assert.throws(
    () =>
      verifyAssetBytes(
        asset('theme-texture', 'webp'),
        Buffer.from('RIFF\0\0\0\0NOPE')
      ),
    /not a valid WebP/u
  );
  assert.throws(
    () => verifyAssetBytes(asset('sound-effect', 'webp'), Buffer.from('OggS')),
    /not a valid Ogg/u
  );
});
