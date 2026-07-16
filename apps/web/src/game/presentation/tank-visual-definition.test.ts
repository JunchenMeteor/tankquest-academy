import type { AssetBundle } from '../../client/assets/index.js';
import { describe, expect, it } from 'vitest';

import {
  ENEMY_BODY_SIZES,
  PLAYER_BODY_SIZE,
  resolveEnemyTankVisual,
  resolvePlayerTankVisual,
} from './tank-visual-definition.js';

function bundle(value: unknown): AssetBundle {
  return {
    source: 'manifest',
    manifest: { levelId: 'level_1', levelVersion: 1, assets: [] },
    resources: new Map([
      [
        'asset_tank_visuals_v1',
        new TextEncoder().encode(JSON.stringify(value)),
      ],
    ]),
  };
}

describe('tank visual definitions', () => {
  it('keeps all player and enemy silhouettes distinct', () => {
    const players = ['star-shield', 'swift-fox', 'iron-mountain'].map((code) =>
      resolvePlayerTankVisual(code)
    );
    const enemies = (['scout', 'medium', 'heavy'] as const).map((role) =>
      resolveEnemyTankVisual(role)
    );

    expect(new Set(players.map((item) => JSON.stringify(item.hull))).size).toBe(
      3
    );
    expect(new Set(enemies.map((item) => JSON.stringify(item.hull))).size).toBe(
      3
    );
    expect(players.map((item) => item.turret.barrelLength)).toEqual([
      35, 31, 40,
    ]);
  });

  it('locks gameplay bodies independently of visual dimensions', () => {
    expect(PLAYER_BODY_SIZE).toEqual({ width: 52, height: 34 });
    expect(ENEMY_BODY_SIZES).toEqual({
      scout: { width: 42, height: 28 },
      medium: { width: 48, height: 32 },
      heavy: { width: 56, height: 38 },
    });
    expect(resolvePlayerTankVisual('iron-mountain').hull.width).toBeGreaterThan(
      PLAYER_BODY_SIZE.width
    );
  });

  it('uses a complete bounded descriptor and falls back on invalid data', () => {
    const descriptor = {
      schemaVersion: 1,
      playerTanks: [
        {
          code: 'star-shield',
          role: 'medium',
          hull: { width: 60, height: 34, cornerRadius: 8 },
          turret: { radius: 15, barrelLength: 35, barrelWidth: 7 },
          details: ['front-star'],
        },
        {
          code: 'swift-fox',
          role: 'scout',
          hull: { width: 52, height: 28, cornerRadius: 12 },
          turret: { radius: 12, barrelLength: 31, barrelWidth: 5 },
          details: ['fox-ears'],
        },
        {
          code: 'iron-mountain',
          role: 'heavy',
          hull: { width: 66, height: 40, cornerRadius: 5 },
          turret: { radius: 18, barrelLength: 40, barrelWidth: 9 },
          details: ['armor-brow'],
        },
      ],
      enemyRoles: [
        {
          role: 'scout',
          hullScale: 0.82,
          turretScale: 0.78,
          barrelScale: 0.82,
        },
        {
          role: 'medium',
          hullScale: 0.94,
          turretScale: 0.92,
          barrelScale: 0.94,
        },
        {
          role: 'heavy',
          hullScale: 1.08,
          turretScale: 1.06,
          barrelScale: 1.08,
        },
      ],
    };

    expect(
      resolvePlayerTankVisual('star-shield', bundle(descriptor)).hull.width
    ).toBe(60);
    expect(resolveEnemyTankVisual('heavy', bundle(descriptor)).hull.width).toBe(
      56
    );
    expect(
      resolvePlayerTankVisual('star-shield', bundle({ broken: true })).hull
        .width
    ).toBe(58);
  });
});
