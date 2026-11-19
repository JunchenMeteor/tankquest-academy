import { DataTexture } from 'three';
import { describe, expect, it } from 'vitest';

import { resolveScenePalette } from '../presentation/map-visual-definition.js';
import {
  battleSurfacePixels,
  createBattleMapMaterials,
} from './battle-map-materials.js';

describe('battle map materials', () => {
  it('generates deterministic, distinct theme surfaces', () => {
    const palette = resolveScenePalette('training-base');
    const first = battleSurfacePixels(
      'training-base',
      palette.floor.base,
      'ground',
      32
    );
    expect(first).toEqual(
      battleSurfacePixels('training-base', palette.floor.base, 'ground', 32)
    );
    expect(first).not.toEqual(
      battleSurfacePixels('forest-camp', palette.floor.base, 'ground', 32)
    );
    expect(first).not.toEqual(
      battleSurfacePixels('snow-field', palette.floor.base, 'ground', 32)
    );
    expect(first).not.toEqual(
      battleSurfacePixels('training-base', palette.obstacle.top, 'cover', 32)
    );
  });

  it('retains readable colours and opaque pixels', () => {
    const palette = resolveScenePalette('snow-field');
    const pixels = battleSurfacePixels(
      'snow-field',
      palette.floor.base,
      'ground',
      32
    );
    for (let index = 0; index < pixels.length; index += 4) {
      expect(pixels[index + 3]).toBe(255);
      expect(
        Math.max(pixels[index]!, pixels[index + 1]!, pixels[index + 2]!)
      ).toBeGreaterThan(100);
    }
  });

  it('shares textured materials across ground and cover and disposes their maps', () => {
    const materials = createBattleMapMaterials(
      'forest-camp',
      resolveScenePalette('forest-camp')
    );
    for (const material of [materials.floor, materials.obstacle]) {
      expect(material.map).toBeInstanceOf(DataTexture);
    }
    const maps = [materials.floor.map, materials.obstacle.map];
    for (const map of maps) {
      const dispose = map!.dispose.bind(map);
      let disposed = false;
      map!.dispose = () => {
        disposed = true;
        dispose();
      };
      Object.assign(map!.userData, { disposed: () => disposed });
    }
    materials.dispose();
    for (const map of maps) expect(map!.userData.disposed()).toBe(true);
  });
});
