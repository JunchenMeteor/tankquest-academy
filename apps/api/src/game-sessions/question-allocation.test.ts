import { describe, expect, it } from 'vitest';

import { allocateSessionQuestions } from './question-allocation.js';

const candidates = Array.from({ length: 8 }, (_, index) => ({
  id: `question_${index + 1}`,
}));

describe('allocateSessionQuestions', () => {
  it('prefers questions not used in the two most recent sessions', () => {
    const selected = allocateSessionQuestions(
      candidates,
      new Set(['question_1', 'question_2', 'question_3']),
      3
    );

    expect(selected.map((question) => question.id)).toEqual([
      'question_4',
      'question_5',
      'question_6',
    ]);
  });

  it('uses recent questions only when fresh content cannot fill the session', () => {
    const selected = allocateSessionQuestions(
      candidates,
      new Set([
        'question_1',
        'question_2',
        'question_3',
        'question_4',
        'question_5',
        'question_6',
        'question_7',
      ]),
      3
    );

    expect(selected.map((question) => question.id)).toEqual([
      'question_8',
      'question_1',
      'question_2',
    ]);
  });

  it('returns no questions for an invalid requested count', () => {
    expect(allocateSessionQuestions(candidates, new Set(), 0)).toEqual([]);
  });

  it('produces different groups for three sessions when ten questions exist', () => {
    const pool = Array.from({ length: 10 }, (_, index) => ({
      id: `official_${index + 1}`,
    }));
    const first = allocateSessionQuestions(pool, new Set(), 3);
    const second = allocateSessionQuestions(
      pool,
      new Set(first.map((question) => question.id)),
      3
    );
    const third = allocateSessionQuestions(
      pool,
      new Set([...first, ...second].map((question) => question.id)),
      3
    );

    expect(
      [first, second, third].map((group) => group.map(({ id }) => id))
    ).toEqual([
      ['official_1', 'official_2', 'official_3'],
      ['official_4', 'official_5', 'official_6'],
      ['official_7', 'official_8', 'official_9'],
    ]);
  });
});
