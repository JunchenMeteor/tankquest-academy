import { describe, expect, it } from 'vitest';

import { buildParentReport } from './parent-report.js';

describe('buildParentReport', () => {
  it('builds deterministic aggregate metrics without raw answer data', () => {
    const report = buildParentReport({
      from: new Date('2026-06-15T00:00:00.000Z'),
      to: new Date('2026-07-15T00:00:00.000Z'),
      completedSessions: 2,
      answers: [
        {
          subject: 'math',
          skillKey: 'addition-within-20',
          correct: true,
          answerTimeMs: 1000,
          difficulty: 1,
          answeredAt: new Date('2026-07-14T00:00:00.000Z'),
        },
        {
          subject: 'math',
          skillKey: 'addition-within-20',
          correct: false,
          answerTimeMs: 2000,
          difficulty: 2,
          answeredAt: new Date('2026-07-15T00:00:00.000Z'),
        },
      ],
    });

    expect(report).toMatchObject({
      completedSessions: 2,
      totalAnswers: 2,
      subjects: [
        {
          subject: 'math',
          attempts: 2,
          correctCount: 1,
          accuracy: 50,
          averageAnswerTimeMs: 1500,
        },
      ],
      recentSkills: [
        {
          skillKey: 'addition-within-20',
          currentDifficulty: 2,
          lastPracticedAt: '2026-07-15T00:00:00.000Z',
        },
      ],
      focusSkill: { subject: 'math', skillKey: 'addition-within-20' },
    });
    expect(JSON.stringify(report)).not.toContain('selectedAnswer');
  });

  it('returns an empty report when no sessions were completed', () => {
    const report = buildParentReport({
      from: new Date('2026-06-15T00:00:00.000Z'),
      to: new Date('2026-07-15T00:00:00.000Z'),
      completedSessions: 0,
      answers: [],
    });

    expect(report).toMatchObject({
      completedSessions: 0,
      totalAnswers: 0,
      subjects: [],
      recentSkills: [],
      focusSkill: null,
    });
  });
});
