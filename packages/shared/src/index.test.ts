import { describe, expect, it } from 'vitest';

import {
  levelEnemyConfigSchema,
  levelMapConfigSchema,
  startSessionRequestSchema,
  submitAnswerRequestSchema,
  tankStatsSchema,
} from './index.js';

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
});
