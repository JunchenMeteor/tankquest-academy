import { describe, expect, it } from 'vitest';

import { localizeQuestion } from './localized-question.js';

const question = {
  prompt: 'Legacy prompt',
  explanation: 'Legacy explanation',
  translations: [
    { locale: 'en', prompt: 'English prompt', explanation: 'English reason' },
    { locale: 'zh-CN', prompt: '中文题目', explanation: '中文讲解' },
  ],
  answers: [
    {
      text: 'Legacy answer',
      translations: [
        { locale: 'en', text: 'English answer' },
        { locale: 'zh-CN', text: '中文答案' },
      ],
    },
  ],
};

describe('localizeQuestion', () => {
  it('selects the requested translation for every learner-visible field', () => {
    expect(localizeQuestion(question, 'zh-CN')).toEqual({
      prompt: '中文题目',
      explanation: '中文讲解',
      choiceTexts: ['中文答案'],
    });
  });

  it('falls back to English and then legacy content', () => {
    expect(
      localizeQuestion(
        {
          ...question,
          translations: question.translations.filter(
            (translation) => translation.locale === 'en'
          ),
          answers: [{ text: 'Legacy answer', translations: [] }],
        },
        'zh-CN'
      )
    ).toEqual({
      prompt: 'English prompt',
      explanation: 'English reason',
      choiceTexts: ['Legacy answer'],
    });
  });
});
