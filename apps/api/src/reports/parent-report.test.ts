import { describe, expect, it } from 'vitest';

import {
  buildDeterministicParentSummary,
  buildParentReport,
} from './parent-report.js';

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
          trend: 'insufficient-data',
        },
      ],
      focusSkill: { subject: 'math', skillKey: 'addition-within-20' },
    });
    expect(JSON.stringify(report)).not.toContain('selectedAnswer');
  });

  it('derives a conservative trend only with enough data in both windows', () => {
    const answers = [
      ...[true, false, false, false, false].map((correct, index) => ({
        subject: 'math' as const,
        skillKey: 'addition-within-20',
        correct,
        answerTimeMs: 2_000,
        difficulty: 1,
        answeredAt: new Date(`2026-06-${20 + index}T00:00:00.000Z`),
      })),
      ...[true, true, true, true, true].map((correct, index) => ({
        subject: 'math' as const,
        skillKey: 'addition-within-20',
        correct,
        answerTimeMs: 1_000,
        difficulty: 1,
        answeredAt: new Date(`2026-07-${10 + index}T00:00:00.000Z`),
      })),
    ];

    const report = buildParentReport({
      from: new Date('2026-06-15T00:00:00.000Z'),
      to: new Date('2026-07-15T00:00:00.000Z'),
      completedSessions: 2,
      answers,
    });

    expect(report.recentSkills[0]?.trend).toBe('improving');
    expect(buildDeterministicParentSummary(report, 'en').progress).toContain(
      '1 skill area'
    );
    expect(buildDeterministicParentSummary(report, 'zh-CN').progress).toContain(
      '1 项技能'
    );
  });

  it.each([
    {
      early: [true, true, true, false, false],
      late: [true, false, true, true, false],
      expected: 'steady',
    },
    {
      early: [true, true, true, true, true],
      late: [true, true, false, false, false],
      expected: 'needs-practice',
    },
  ] as const)(
    'derives $expected only from two sufficiently sampled windows',
    ({ early, late, expected }) => {
      const report = buildParentReport({
        from: new Date('2026-06-15T00:00:00.000Z'),
        to: new Date('2026-07-15T00:00:00.000Z'),
        completedSessions: 2,
        answers: [
          ...early.map((correct, index) => ({
            subject: 'math' as const,
            skillKey: 'addition-within-20',
            correct,
            answerTimeMs: 2_000,
            difficulty: 1,
            answeredAt: new Date(`2026-06-${20 + index}T00:00:00.000Z`),
          })),
          ...late.map((correct, index) => ({
            subject: 'math' as const,
            skillKey: 'addition-within-20',
            correct,
            answerTimeMs: 1_000,
            difficulty: 1,
            answeredAt: new Date(`2026-07-${10 + index}T00:00:00.000Z`),
          })),
        ],
      });

      expect(report.recentSkills[0]?.trend).toBe(expected);
    }
  );

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
