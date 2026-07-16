import type { AssetBundle } from '../../client/assets/index.js';
import { describe, expect, it } from 'vitest';

import { resolveScenePalette } from './map-visual-definition.js';

function bundle(value: unknown): AssetBundle {
  return {
    source: 'manifest',
    manifest: { levelId: 'level_1', levelVersion: 1, assets: [] },
    resources: new Map([
      [
        'asset_training_grounds_v1',
        new TextEncoder().encode(JSON.stringify(value)),
      ],
    ]),
  };
}

describe('scene visual palettes', () => {
  it('keeps all three built-in themes visually distinct', () => {
    const palettes = ['training-base', 'forest-camp', 'snow-field'].map(
      (theme) =>
        resolveScenePalette(
          theme as 'training-base' | 'forest-camp' | 'snow-field'
        ).floor.base
    );
    expect(new Set(palettes).size).toBe(3);
  });

  it('uses a complete descriptor and rejects malformed resources', () => {
    const descriptor = {
      schemaVersion: 1,
      coordinateSystem: 'world-2d',
      themes: [
        theme('training-base', '#111111'),
        theme('forest-camp', '#222222'),
        theme('snow-field', '#333333'),
      ],
    };
    expect(
      resolveScenePalette('snow-field', bundle(descriptor)).floor.base
    ).toBe(0x333333);
    expect(resolveScenePalette('snow-field', bundle({})).floor.base).toBe(
      0xc7dce4
    );
  });
});

function theme(id: string, base: string) {
  return {
    id,
    floor: { base, grid: '#444444', accent: '#555555' },
    boundary: { top: '#666666', side: '#777777' },
    obstacle: { top: '#888888', side: '#999999' },
    shadow: '#11111166',
  };
}
