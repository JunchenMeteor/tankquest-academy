export type SupportedLocale = 'en' | 'zh-CN';

export interface LocalizedQuestionSource {
  prompt: string;
  explanation: string;
  translations: Array<{
    locale: string;
    prompt: string;
    explanation: string;
  }>;
  answers: Array<{
    text: string;
    translations: Array<{ locale: string; text: string }>;
  }>;
}

export function localizeQuestion<T extends LocalizedQuestionSource>(
  question: T,
  locale: SupportedLocale
) {
  const translation =
    question.translations.find((item) => item.locale === locale) ??
    question.translations.find((item) => item.locale === 'en');

  return {
    prompt: translation?.prompt ?? question.prompt,
    explanation: translation?.explanation ?? question.explanation,
    choiceTexts: question.answers.map(
      (answer) =>
        answer.translations.find((item) => item.locale === locale)?.text ??
        answer.translations.find((item) => item.locale === 'en')?.text ??
        answer.text
    ),
  };
}
