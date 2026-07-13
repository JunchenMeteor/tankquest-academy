import { describe, expect, it } from 'vitest';

import {
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
});
