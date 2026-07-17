import type { AssetBundle } from '../../client/assets/index.js';
import { describe, expect, it, vi } from 'vitest';

import {
  EXPERIENCE_GROUND_TEXTURE,
  prepareExperienceAssets,
} from './experience-assets.js';

function bundle(ids: string[]): AssetBundle {
  return {
    source: 'manifest',
    manifest: {
      levelId: 'level_1',
      levelVersion: 1,
      assets: [],
    },
    resources: new Map(
      ids.map((id, index) => [id, new Uint8Array([index + 1])])
    ),
  };
}

describe('experience asset preparation', () => {
  it('selects the current theme texture and bounded combat audio resources', () => {
    const create = vi
      .fn<(blob: Blob) => string>()
      .mockImplementation(() => `blob:${create.mock.calls.length}`);
    const revoke = vi.fn();
    const assets = prepareExperienceAssets(
      bundle([
        'asset_forest_camp_ground_v2',
        'asset_cannon_fire_v1',
        'asset_destroyed_v1',
        'asset_forest_camp_ambience_v1',
      ]),
      'forest-camp',
      { create, revoke }
    );

    expect(EXPERIENCE_GROUND_TEXTURE).toBe('experience-ground-texture');
    expect(assets.groundTextureUrl).toBe('blob:1');
    expect(assets.audio.map((asset) => asset.key)).toEqual([
      'combat-fire',
      'combat-destroyed',
      'ambient-forest-camp',
    ]);
    expect(create).toHaveBeenCalledTimes(4);

    assets.release();
    assets.release();
    expect(revoke).toHaveBeenCalledTimes(4);
  });

  it('returns an empty, safe bundle when verified assets are unavailable', () => {
    const assets = prepareExperienceAssets(undefined, 'snow-field', {
      create: vi.fn(),
      revoke: vi.fn(),
    });

    expect(assets.groundTextureUrl).toBeUndefined();
    expect(assets.audio).toEqual([]);
    expect(() => assets.release()).not.toThrow();
  });

  it('falls back safely when the browser rejects object URL creation', () => {
    const revoke = vi.fn();
    const assets = prepareExperienceAssets(
      bundle([
        'asset_training_base_ground_v2',
        'asset_cannon_fire_v1',
        'asset_training_base_ambience_v1',
      ]),
      'training-base',
      {
        create: vi.fn(() => {
          throw new Error('object URLs unavailable');
        }),
        revoke,
      }
    );

    expect(assets.groundTextureUrl).toBeUndefined();
    expect(assets.audio).toEqual([]);
    expect(() => assets.release()).not.toThrow();
    expect(revoke).not.toHaveBeenCalled();
  });
});
