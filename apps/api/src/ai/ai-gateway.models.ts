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

export const aiPracticeRecommendationRequestSchema = z
  .object({
    ageGroup: z.enum(['6-8', '9-12']),
    subject: z.enum(['math', 'english', 'direction']),
    skillKey: z
      .string()
      .min(1)
      .max(64)
      .regex(/^[a-z0-9-]+$/),
    currentDifficulty: z.number().int().min(1).max(5),
    attempts: z.number().int().min(0).max(100_000),
    accuracy: z.number().min(0).max(100),
    averageAnswerTimeMs: z
      .number()
      .int()
      .min(0)
      .max(30 * 60 * 1000),
    completedSessions: z.number().int().min(0).max(100_000),
    allowedDifficulty: z
      .object({
        min: z.number().int().min(1).max(5),
        max: z.number().int().min(1).max(5),
      })
      .strict(),
  })
  .strict()
  .refine(
    ({ allowedDifficulty }) => allowedDifficulty.min <= allowedDifficulty.max,
    'allowedDifficulty min must not exceed max'
  );

export type AiPracticeRecommendationRequest = z.infer<
  typeof aiPracticeRecommendationRequestSchema
>;

const aiParentReportSubjectMetricSchema = z
  .object({
    subject: z.enum(['math', 'english', 'direction', 'logic', 'physics']),
    attempts: z.number().int().min(0).max(100_000),
    accuracy: z.number().min(0).max(100),
    averageAnswerTimeMs: z
      .number()
      .int()
      .min(0)
      .max(30 * 60 * 1000),
  })
  .strict();

const aiParentReportSkillMetricSchema = aiParentReportSubjectMetricSchema
  .extend({
    skillKey: z
      .string()
      .min(1)
      .max(64)
      .regex(/^[a-z0-9-]+$/),
    currentDifficulty: z.number().int().min(1).max(5).optional(),
    trend: z.enum([
      'improving',
      'steady',
      'needs-practice',
      'insufficient-data',
    ]),
  })
  .strict();

export const aiParentReportSummaryRequestSchema = z
  .object({
    locale: z.enum(['en', 'zh-CN']),
    completedSessions: z.number().int().min(0).max(100_000),
    totalAnswers: z.number().int().min(0).max(100_000),
    subjects: z.array(aiParentReportSubjectMetricSchema).max(5),
    skills: z.array(aiParentReportSkillMetricSchema).max(5),
  })
  .strict();

export type AiParentReportSummaryRequest = z.infer<
  typeof aiParentReportSummaryRequestSchema
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

export const aiPracticeRecommendationResponseSchema = z
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
    subject: z.enum(['math', 'english', 'direction']),
    skillKey: z.string().min(1).max(64),
    recommendedDifficulty: z.number().int().min(1).max(5),
    practiceIntent: z.enum(['review', 'reinforce', 'challenge']),
  })
  .strict();

export type AiPracticeRecommendationResponse = z.infer<
  typeof aiPracticeRecommendationResponseSchema
>;

const aiParentReportSummarySchema = z
  .object({
    practiceContent: z.string().trim().min(1).max(240),
    progress: z.string().trim().min(1).max(240),
    attention: z.string().trim().min(1).max(240),
    nextStep: z.string().trim().min(1).max(240),
  })
  .strict();

export const aiParentReportSummaryResponseSchema = z
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
    summary: aiParentReportSummarySchema,
  })
  .strict();

export type AiParentReportSummaryResponse = z.infer<
  typeof aiParentReportSummaryResponseSchema
>;
