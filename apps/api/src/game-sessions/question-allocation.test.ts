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
});
