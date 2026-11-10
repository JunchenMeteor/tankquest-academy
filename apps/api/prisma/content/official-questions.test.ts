import { describe, expect, it } from 'vitest';

import {
  officialQuestionSeeds,
  validateOfficialQuestions,
  type OfficialQuestionSeed,
} from './official-questions.js';

const mathQuestions = officialQuestionSeeds.filter(
  (question) => question.subject === 'math'
);

function evaluateMathPrompt(question: OfficialQuestionSeed): number {
  const expression = question.prompt.en
    .replace(/^Calculate\s+/, '')
    .replaceAll('×', '*')
    .replaceAll('÷', '/')
    .replace(/[.。]$/, '')
    .replace(/=\s*\?$/, '')
    .trim();
  return Function(`"use strict"; return (${expression})`)() as number;
}

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
    expect(first?.choices[first.correctIndex]?.en).toBe('6');
    expect(first?.choices[first.correctIndex]?.['zh-CN']).toBe('6');

    const chinese = officialQuestionSeeds.find(
      (question) => question.code === 'official-english-d1-01'
    );
    expect(chinese?.prompt['zh-CN']).toContain('是什么意思');
    expect(chinese?.explanation['zh-CN']).toContain('敢于面对危险');
  });

  it('starts with multiplication and division and increases arithmetic complexity', () => {
    const tiers = [1, 2, 3, 4].map((difficulty) =>
      mathQuestions.filter((question) => question.difficulty === difficulty)
    );
    for (const question of tiers[0] ?? []) {
      expect(question.prompt.en).toMatch(/[×÷]/);
      expect(question.prompt.en).not.toMatch(/[+-]/);
    }
    expect(
      tiers[1]?.some((question) =>
        question.prompt.en.match(/\d+/g)?.some((value) => Number(value) >= 50)
      )
    ).toBe(true);
    expect(
      tiers[2]?.some((question) =>
        question.prompt.en.match(/\d+/g)?.some((value) => Number(value) >= 100)
      )
    ).toBe(true);
    for (const question of tiers[3] ?? []) {
      expect(question.prompt.en).toMatch(/[×÷]/);
      expect(question.prompt.en).toMatch(/[+-]/);
    }
    for (const tier of tiers) {
      expect(new Set(tier.map((question) => question.skillKey))).toEqual(
        new Set(['multiplication-facts', 'division-facts'])
      );
      for (const question of tier) {
        expect(question.choices).toHaveLength(4);
      }
    }
  });

  it('computes every official math answer from its localized expression', () => {
    for (const question of mathQuestions) {
      expect(question.choices[question.correctIndex]?.en).toBe(
        String(evaluateMathPrompt(question))
      );
      expect(question.choices[question.correctIndex]?.['zh-CN']).toBe(
        String(evaluateMathPrompt(question))
      );
    }
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
