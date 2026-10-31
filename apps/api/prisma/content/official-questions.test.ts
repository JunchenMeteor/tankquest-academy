import { describe, expect, it } from 'vitest';

import {
  officialQuestionSeeds,
  validateOfficialQuestions,
} from './official-questions.js';

describe('officialQuestionSeeds', () => {
  it('contains ten localized questions in every subject and difficulty bucket', () => {
    expect(officialQuestionSeeds).toHaveLength(120);
    for (const subject of ['math', 'english', 'direction'] as const) {
      for (const difficulty of [1, 2, 3, 4] as const) {
        expect(
          officialQuestionSeeds.filter(
            (question) =>
              question.subject === subject && question.difficulty === difficulty
          )
        ).toHaveLength(10);
      }
    }
  });

  it('keeps stable identities and aligned bilingual answers', () => {
    const first = officialQuestionSeeds[0];
    expect(first).toMatchObject({
      id: 'question_official_math_d1_01',
      code: 'official-math-d1-01',
      subject: 'math',
      difficulty: 1,
    });
    expect(first?.choices[first.correctIndex]?.en).toBe('9');
    expect(first?.choices[first.correctIndex]?.['zh-CN']).toBe('9');

    const chinese = officialQuestionSeeds.find(
      (question) => question.code === 'official-english-d1-01'
    );
    expect(chinese?.prompt['zh-CN']).toContain('是什么意思');
    expect(chinese?.explanation['zh-CN']).toContain('敢于面对危险');
  });

  it('rejects incomplete or ambiguous official content', () => {
    const duplicate = officialQuestionSeeds.map((question) => ({
      ...question,
      choices: question.choices.map((choice) => ({ ...choice })),
    }));
    const first = duplicate[0];
    if (!first) throw new Error('Missing test question');
    first.choices[1] = { ...first.choices[0] };

    expect(() => validateOfficialQuestions(duplicate)).toThrow(
      'Choices must be localized and unique'
    );
  });
});
