import { z } from 'zod';

import { ageGroups, gameModes, subjects, tankStatMax } from './domain.js';

const identifierSchema = z.string().trim().min(1).max(100);

export const ageGroupSchema = z.enum(ageGroups);
export const gameModeSchema = z.enum(gameModes);
export const subjectSchema = z.enum(subjects);

export const tankStatsSchema = z.object({
  firepower: z.number().int().min(1).max(tankStatMax),
  mobility: z.number().int().min(1).max(tankStatMax),
  armor: z.number().int().min(1).max(tankStatMax),
  stealth: z.number().int().min(1).max(tankStatMax),
  vision: z.number().int().min(1).max(tankStatMax),
});

export const startSessionRequestSchema = z.object({
  childId: identifierSchema,
  levelId: identifierSchema,
  tankId: identifierSchema,
});

export const submitAnswerRequestSchema = z.object({
  questionId: identifierSchema,
  selectedAnswerId: identifierSchema,
  answerTimeMs: z
    .number()
    .int()
    .min(0)
    .max(30 * 60 * 1000),
});

export const gameEventSchema = z.object({
  eventType: z.enum([
    'enemy_defeated',
    'player_hit',
    'supply_collected',
    'objective_completed',
    'question_presented',
    'level_finished',
  ]),
  payload: z.record(z.string(), z.unknown()),
  clientTimeMs: z
    .number()
    .int()
    .min(0)
    .max(60 * 60 * 1000),
});

export const upgradeTankRequestSchema = z.object({
  stat: z.enum(['firepower', 'mobility', 'armor', 'stealth', 'vision']),
});
