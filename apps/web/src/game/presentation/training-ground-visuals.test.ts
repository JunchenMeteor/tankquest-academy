import { describe, expect, it } from 'vitest';

import {
  mapVisualSignature,
  obstacleVisualGeometry,
} from './training-ground-visuals.js';

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
});
