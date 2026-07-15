import type { AdaptiveLearningContext } from './game-session.models.js';
import { describe, expect, it } from 'vitest';
import {
  buildAdaptivePracticePolicy,
  resolveNextPractice,
} from './adaptive-learning.js';

const baseContext: AdaptiveLearningContext = {
  ageGroup: 'child_6_8',
  maxDifficulty: 3,
  completedSessions: 4,
  records: [
    {
      subject: 'math',
      skillKey: 'addition-within-20',
      attempts: 5,
      correctCount: 4,
      averageAnswerTimeMs: 8_000,
      currentDifficulty: 1,
    },
  ],
  levels: [
    {
      id: 'level_1',
      subject: 'math',
      difficulty: 1,
      skillKeys: ['addition-within-20'],
    },
    {
      id: 'level_2',
      subject: 'math',
      difficulty: 2,
      skillKeys: ['addition-within-20'],
    },
  ],
};

function policy(context: AdaptiveLearningContext = baseContext) {
  const result = buildAdaptivePracticePolicy(context);
  if (!result) throw new Error('Expected an adaptive policy');
  return result;
}

function aiResponse(
  overrides: Partial<{
    subject: 'math' | 'english' | 'direction';
    skillKey: string;
    recommendedDifficulty: number;
    practiceIntent: 'review' | 'reinforce' | 'challenge';
  }> = {}
) {
  return {
    requestId: 'e96e124f-98d5-44b9-9690-002f7a5a5454',
    source: 'model' as const,
    fallbackReason: null,
    subject: 'math' as const,
    skillKey: 'addition-within-20',
    recommendedDifficulty: 2,
    practiceIntent: 'challenge' as const,
    ...overrides,
  };
}

describe('adaptive learning policy', () => {
  it('keeps difficulty and skips AI when there is insufficient data', () => {
    const result = policy({
      ...baseContext,
      records: [{ ...baseContext.records[0]!, attempts: 2, correctCount: 2 }],
    });

    expect(result.skipAi).toBe(true);
    expect(result.allowedDifficulty).toEqual({ min: 1, max: 1 });
    expect(resolveNextPractice(result, null)).toMatchObject({
      levelId: 'level_1',
      difficulty: 1,
      intent: 'reinforce',
      decision: 'fallback',
      reason: 'insufficient_data',
    });
  });

  it('reviews one level lower after low accuracy', () => {
    const result = policy({
      ...baseContext,
      records: [
        {
          ...baseContext.records[0]!,
          attempts: 5,
          correctCount: 2,
          currentDifficulty: 2,
        },
      ],
    });

    expect(result.allowedDifficulty).toEqual({ min: 1, max: 2 });
    expect(resolveNextPractice(result, null)).toMatchObject({
      levelId: 'level_1',
      intent: 'review',
      reason: 'ai_unavailable',
    });
  });

  it('clamps an AI challenge to a one-level backend range', () => {
    const result = policy();
    const recommendation = resolveNextPractice(
      result,
      aiResponse({ recommendedDifficulty: 5 })
    );

    expect(result.allowedDifficulty).toEqual({ min: 1, max: 2 });
    expect(recommendation).toMatchObject({
      levelId: 'level_2',
      difficulty: 2,
      decision: 'adjusted',
      reason: 'outside_policy',
    });
  });

  it('keeps the current difficulty when strong answers are slow', () => {
    const result = policy({
      ...baseContext,
      records: [{ ...baseContext.records[0]!, averageAnswerTimeMs: 20_000 }],
    });

    expect(result.allowedDifficulty).toEqual({ min: 1, max: 1 });
    expect(resolveNextPractice(result, aiResponse())).toMatchObject({
      difficulty: 1,
      reason: 'outside_policy',
    });
  });

  it('records when the parent maximum prevents a challenge', () => {
    const result = policy({
      ...baseContext,
      maxDifficulty: 1,
      levels: [baseContext.levels[0]!],
    });

    expect(result.parentLimited).toBe(true);
    expect(
      resolveNextPractice(result, aiResponse({ recommendedDifficulty: 1 }))
    ).toMatchObject({
      difficulty: 1,
      decision: 'adjusted',
      reason: 'parent_limit',
    });
  });

  it('uses existing content and records unavailable higher difficulty', () => {
    const result = policy({
      ...baseContext,
      records: [
        {
          ...baseContext.records[0]!,
          subject: 'english',
          skillKey: 'basic-word-meaning',
        },
      ],
      levels: [
        {
          id: 'english_1',
          subject: 'english',
          difficulty: 1,
          skillKeys: ['basic-word-meaning'],
        },
      ],
    });

    expect(
      resolveNextPractice(
        result,
        aiResponse({
          subject: 'english',
          skillKey: 'basic-word-meaning',
          recommendedDifficulty: 2,
        })
      )
    ).toMatchObject({
      levelId: 'english_1',
      difficulty: 1,
      decision: 'adjusted',
      reason: 'content_unavailable',
    });
  });

  it('rejects an AI attempt to change the backend-selected focus', () => {
    expect(
      resolveNextPractice(policy(), aiResponse({ skillKey: 'different-skill' }))
    ).toMatchObject({
      levelId: 'level_2',
      decision: 'rejected',
      reason: 'invalid_focus',
    });
  });
});
