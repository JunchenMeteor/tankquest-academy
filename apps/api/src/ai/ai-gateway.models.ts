import { z } from 'zod';

export type AiDependencyStatus = 'ok' | 'degraded';

export const aiQuestionDraftRequestSchema = z
  .object({
    ageGroup: z.enum(['6-8', '9-12']),
    locale: z.enum(['en', 'zh-CN']),
    subject: z.enum(['math', 'english', 'direction']),
    skillKey: z
      .string()
      .min(1)
      .max(64)
      .regex(/^[a-z0-9-]+$/),
    difficulty: z.number().int().min(1).max(5),
  })
  .strict();

export type AiQuestionDraftRequest = z.infer<
  typeof aiQuestionDraftRequestSchema
>;

export const aiWrongAnswerExplanationRequestSchema = z
  .object({
    ageGroup: z.enum(['6-8', '9-12']),
    locale: z.enum(['en', 'zh-CN']),
    subject: z.enum(['math', 'english', 'direction']),
    skillKey: z
      .string()
      .min(1)
      .max(64)
      .regex(/^[a-z0-9-]+$/),
    difficulty: z.number().int().min(1).max(5),
    question: z.string().trim().min(1).max(240),
    selectedAnswer: z.string().trim().min(1).max(80),
    correctAnswer: z.string().trim().min(1).max(80),
  })
  .strict()
  .refine(
    ({ selectedAnswer, correctAnswer }) => selectedAnswer !== correctAnswer,
    'selectedAnswer must differ from correctAnswer'
  );

export type AiWrongAnswerExplanationRequest = z.infer<
  typeof aiWrongAnswerExplanationRequestSchema
>;

const questionDraftSchema = z
  .object({
    question: z.string().min(1).max(240),
    choices: z.array(z.string().min(1).max(80)).min(3).max(4),
    correctAnswer: z.string().min(1).max(80),
    explanation: z.string().min(1).max(320),
  })
  .strict()
  .refine(({ choices }) => new Set(choices).size === choices.length, {
    message: 'choices must be unique',
  })
  .refine(
    ({ choices, correctAnswer }) =>
      choices.filter((choice) => choice === correctAnswer).length === 1,
    'correctAnswer must match exactly one choice'
  );

export const aiHealthSchema = z
  .object({
    status: z.enum(['ok', 'degraded']),
    requestedProvider: z.enum(['template', 'openai']),
    effectiveProvider: z.enum(['template', 'model']),
  })
  .strict();

export const aiQuestionDraftResponseSchema = z
  .object({
    requestId: z.string().uuid(),
    source: z.enum(['template', 'model']),
    fallbackReason: z
      .enum([
        'config_missing',
        'provider_error',
        'unsafe_output',
        'invalid_output',
      ])
      .nullable(),
    draft: questionDraftSchema,
  })
  .strict();

export type AiQuestionDraftResponse = z.infer<
  typeof aiQuestionDraftResponseSchema
>;

export const aiWrongAnswerExplanationResponseSchema = z
  .object({
    requestId: z.string().uuid(),
    source: z.enum(['template', 'model']),
    fallbackReason: z
      .enum([
        'config_missing',
        'provider_error',
        'unsafe_output',
        'invalid_output',
      ])
      .nullable(),
    correctAnswer: z.string().trim().min(1).max(80),
    explanation: z.string().trim().min(1).max(320),
  })
  .strict();

export type AiWrongAnswerExplanationResponse = z.infer<
  typeof aiWrongAnswerExplanationResponseSchema
>;
