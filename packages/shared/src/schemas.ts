import { z } from 'zod';

import {
  ageGroups,
  enemyTankRoles,
  gameModes,
  subjects,
  tankStatMax,
  trainingMapStyles,
} from './domain.js';

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

export const enemyTankConfigSchema = z.object({
  id: identifierSchema,
  role: z.enum(enemyTankRoles),
  x: z.number().min(40).max(920),
  y: z.number().min(40).max(500),
  stats: tankStatsSchema,
  ai: z.object({
    detectionRange: z.number().min(100).max(600),
    attackRange: z.number().min(80).max(500),
    fireCooldownMs: z.number().int().min(500).max(5000),
    speedMultiplier: z.number().min(0.1).max(1),
  }),
});

export const levelEnemyConfigSchema = z.object({
  enemyTanks: z.array(enemyTankConfigSchema).min(1).max(8),
});

const mapCoordinateSchema = z.number().min(30).max(930);

export const levelMapConfigSchema = z.object({
  style: z.enum(trainingMapStyles),
  playerSpawn: z.object({
    x: mapCoordinateSchema,
    y: z.number().min(30).max(510),
  }),
  obstacles: z
    .array(
      z.object({
        x: mapCoordinateSchema,
        y: z.number().min(30).max(510),
        width: z.number().min(20).max(300),
        height: z.number().min(20).max(300),
      })
    )
    .max(24),
});

export const levelRuntimeContentSchema = levelEnemyConfigSchema.extend({
  map: levelMapConfigSchema,
});

export const startSessionRequestSchema = z.object({
  childId: identifierSchema,
  levelId: identifierSchema,
  tankId: identifierSchema,
});

export const submitAnswerRequestSchema = z.object({
  questionId: identifierSchema,
  selectedAnswerId: identifierSchema,
  locale: z.enum(['en', 'zh-CN']).default('en'),
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
