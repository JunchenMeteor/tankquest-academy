import { describe, expect, it } from 'vitest';

import { toLearningProgress } from './learning-progress.js';

describe('toLearningProgress', () => {
  it('derives a stable whole-number accuracy without exposing answers', () => {
    expect(
      toLearningProgress({
        subject: 'math',
        skillKey: 'addition-within-20',
        attempts: 3,
        correctCount: 2,
        averageAnswerTimeMs: 1400,
        currentDifficulty: 2,
        updatedAt: new Date('2026-07-15T00:00:00.000Z'),
      })
    ).toEqual({
      subject: 'math',
      skillKey: 'addition-within-20',
      attempts: 3,
      correctCount: 2,
      accuracy: 67,
      averageAnswerTimeMs: 1400,
      currentDifficulty: 2,
      updatedAt: '2026-07-15T00:00:00.000Z',
    });
  });
});
