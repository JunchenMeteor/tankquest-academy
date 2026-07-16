import { describe, expect, it } from 'vitest';

import {
  assetManifestEntrySchema,
  assetManifestSchema,
  levelEnemyConfigSchema,
  levelMapConfigSchema,
  startSessionRequestSchema,
  submitAnswerRequestSchema,
  tankStatsSchema,
} from './index.js';

const tankVisualAsset = {
  assetId: 'tank_visuals_v1',
  type: 'tank-visuals' as const,
  version: '1.0.0',
  url: '/assets/phase4/v1/tank-visuals.json',
  sha256: 'a'.repeat(64),
  sizeBytes: 1024,
  tags: ['tank', 'visual'],
  preview: null,
  dependencies: [],
};

describe('shared contracts', () => {
  it('accepts a valid session request', () => {
    expect(
      startSessionRequestSchema.parse({
        childId: 'child_001',
        levelId: 'level_001',
        tankId: 'tank_001',
      })
    ).toEqual({
      childId: 'child_001',
      levelId: 'level_001',
      tankId: 'tank_001',
    });
  });

  it('rejects invalid tank stats', () => {
    expect(() =>
      tankStatsSchema.parse({
        firepower: 6,
        mobility: 3,
        armor: 3,
        stealth: 3,
        vision: 3,
      })
    ).toThrow();
  });

  it('bounds answer time reported by a client', () => {
    expect(() =>
      submitAnswerRequestSchema.parse({
        questionId: 'q_001',
        selectedAnswerId: 'a',
        answerTimeMs: -1,
      })
    ).toThrow();
  });

  it('defaults legacy answer requests to English', () => {
    expect(
      submitAnswerRequestSchema.parse({
        questionId: 'q_001',
        selectedAnswerId: 'a',
        answerTimeMs: 500,
      }).locale
    ).toBe('en');
  });

  it('validates backend-owned enemy tank compositions', () => {
    expect(
      levelEnemyConfigSchema.parse({
        enemyTanks: [
          {
            id: 'scout_1',
            role: 'scout',
            x: 720,
            y: 150,
            stats: {
              firepower: 2,
              mobility: 4,
              armor: 1,
              stealth: 4,
              vision: 3,
            },
            ai: {
              detectionRange: 300,
              attackRange: 210,
              fireCooldownMs: 1800,
              speedMultiplier: 0.4,
            },
          },
        ],
      }).enemyTanks
    ).toHaveLength(1);
  });

  it('validates backend-owned battlefield geometry', () => {
    expect(
      levelMapConfigSchema.parse({
        style: 'gate',
        playerSpawn: { x: 120, y: 270 },
        obstacles: [{ x: 360, y: 120, width: 50, height: 170 }],
      })
    ).toMatchObject({ style: 'gate' });
  });

  it('accepts a strict, same-origin versioned asset manifest', () => {
    expect(
      assetManifestSchema.parse({
        levelId: 'level_addition_range',
        levelVersion: 2,
        assets: [
          tankVisualAsset,
          {
            assetId: 'training_grounds_v1',
            type: 'scene-description',
            version: '1.0.0',
            url: '/assets/phase4/v1/training-grounds.json',
            sha256: 'b'.repeat(64),
            sizeBytes: 2048,
            tags: ['scene', 'training'],
            preview: '/assets/phase4/v1/training-grounds-preview.svg',
            dependencies: ['tank_visuals_v1'],
          },
        ],
      }).assets
    ).toHaveLength(2);
  });

  it('rejects cross-origin paths and unexpected manifest fields', () => {
    expect(() =>
      assetManifestEntrySchema.parse({
        ...tankVisualAsset,
        url: 'https://cdn.example.com/tank-visuals.json',
      })
    ).toThrow();
    expect(() =>
      assetManifestEntrySchema.parse({ ...tankVisualAsset, trusted: true })
    ).toThrow();
  });

  it('rejects incomplete and cyclic dependency graphs', () => {
    const baseManifest = {
      levelId: 'level_addition_range',
      levelVersion: 2,
    };
    expect(() =>
      assetManifestSchema.parse({
        ...baseManifest,
        assets: [{ ...tankVisualAsset, dependencies: ['missing_asset'] }],
      })
    ).toThrow();
    expect(() =>
      assetManifestSchema.parse({
        ...baseManifest,
        assets: [
          { ...tankVisualAsset, dependencies: ['training_grounds_v1'] },
          {
            ...tankVisualAsset,
            assetId: 'training_grounds_v1',
            dependencies: ['tank_visuals_v1'],
          },
        ],
      })
    ).toThrow();
  });
});
