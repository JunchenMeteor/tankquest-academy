import { describe, expect, it } from 'vitest';

import {
  drawTrainingGround,
  mapVisualSignature,
  obstacleVisualGeometry,
} from './training-ground-visuals.js';
import { resolveScenePalette } from './map-visual-definition.js';

describe('2.5D training-ground presentation', () => {
  it('uses distinct visual signatures for the three map styles', () => {
    const signatures = ['range', 'gate', 'patrol'].map((style) =>
      mapVisualSignature(style as 'range' | 'gate' | 'patrol')
    );
    expect(new Set(signatures).size).toBe(3);
  });

  it('keeps the obstacle top footprint equal to backend collider geometry', () => {
    const obstacle = { x: 500, y: 270, width: 80, height: 150 };
    const geometry = obstacleVisualGeometry(obstacle);

    expect(geometry.top).toEqual({ x: 460, y: 195, width: 80, height: 150 });
    expect(geometry.extrusion).toBeGreaterThan(0);
  });

  it('passes the resolved theme palette into the Phaser ground layer', () => {
    const calls: Array<[string, unknown[]]> = [];
    const graphics = new Proxy(
      {},
      {
        get:
          (_target, property) =>
          (...args: unknown[]) => {
            calls.push([String(property), args]);
            return graphics;
          },
      }
    );
    const scene = { add: { graphics: () => graphics } };
    const palette = resolveScenePalette('snow-field');

    drawTrainingGround(scene as never, 960, 540, 'range', palette);

    expect(calls).toContainEqual(['fillStyle', [palette.floor.base, 1]]);
    expect(calls).toContainEqual(['lineStyle', [1, palette.floor.grid, 0.38]]);
  });

  it('layers a verified theme texture beneath deterministic map markings', () => {
    const textureCalls: Array<[string, unknown[]]> = [];
    const texture = new Proxy(
      {},
      {
        get:
          (_target, property) =>
          (...args: unknown[]) => {
            textureCalls.push([String(property), args]);
            return texture;
          },
      }
    );
    const graphics = new Proxy({}, { get: () => () => graphics });
    const scene = {
      add: {
        graphics: () => graphics,
        tileSprite: (...args: unknown[]) => {
          textureCalls.push(['tileSprite', args]);
          return texture;
        },
      },
      textures: { exists: () => true },
    };

    drawTrainingGround(
      scene as never,
      960,
      540,
      'gate',
      resolveScenePalette('forest-camp'),
      'experience-ground-texture'
    );

    expect(textureCalls).toContainEqual([
      'tileSprite',
      [480, 270, 960, 540, 'experience-ground-texture'],
    ]);
    expect(textureCalls).toContainEqual(['setDepth', [-21]]);
    expect(textureCalls).toContainEqual(['setAlpha', [0.72]]);
  });
});
