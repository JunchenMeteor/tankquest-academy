import { z } from 'zod';

import {
  ageGroups,
  assetTypes,
  enemyTankRoles,
  gameModes,
  subjects,
  tankStatMax,
  trainingMapStyles,
} from './domain.js';

const identifierSchema = z.string().trim().min(1).max(100);
export const localeSchema = z.enum(['en', 'zh-CN']);

export const assetManifestMaxAssets = 32;
export const assetMaxSizeBytes = 256 * 1024;
export const assetManifestMaxSizeBytes = 2 * 1024 * 1024;

const assetVersionedPathSchema = z
  .string()
  .regex(
    /^\/assets\/phase4\/v[1-9]\d*\/(?:[a-z0-9][a-z0-9._-]*\/)*[a-z0-9][a-z0-9._-]*$/,
    'Asset paths must be same-origin, versioned Phase 4 paths'
  );

const uniqueStrings = (values: string[]) =>
  new Set(values).size === values.length;

export const assetManifestEntrySchema = z
  .object({
    assetId: identifierSchema,
    type: z.enum(assetTypes),
    version: z.string().regex(/^\d+\.\d+\.\d+$/),
    url: assetVersionedPathSchema,
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    sizeBytes: z.number().int().positive().max(assetMaxSizeBytes),
    tags: z
      .array(z.string().regex(/^[a-z0-9][a-z0-9-]{0,39}$/))
      .max(16)
      .refine(uniqueStrings, 'Asset tags must be unique'),
    preview: assetVersionedPathSchema.nullable(),
    dependencies: z
      .array(identifierSchema)
      .max(assetManifestMaxAssets)
      .refine(uniqueStrings, 'Asset dependencies must be unique'),
  })
  .strict();

export const assetManifestRequestSchema = z
  .object({ levelId: identifierSchema })
  .strict();

export const assetManifestSchema = z
  .object({
    levelId: identifierSchema,
    levelVersion: z.number().int().positive(),
    assets: z.array(assetManifestEntrySchema).max(assetManifestMaxAssets),
  })
  .strict()
  .superRefine((manifest, context) => {
    const assets = new Map(
      manifest.assets.map((asset) => [asset.assetId, asset])
    );
    if (assets.size !== manifest.assets.length) {
      context.addIssue({
        code: 'custom',
        message: 'Asset IDs must be unique',
        path: ['assets'],
      });
    }

    const totalBytes = manifest.assets.reduce(
      (total, asset) => total + asset.sizeBytes,
      0
    );
    if (totalBytes > assetManifestMaxSizeBytes) {
      context.addIssue({
        code: 'too_big',
        maximum: assetManifestMaxSizeBytes,
        origin: 'number',
        inclusive: true,
        message: 'Asset manifest exceeds its byte budget',
        path: ['assets'],
      });
    }

    const visited = new Set<string>();
    const visiting = new Set<string>();
    const visit = (assetId: string): boolean => {
      if (visited.has(assetId)) return true;
      if (visiting.has(assetId)) return false;
      const asset = assets.get(assetId);
      if (!asset) return false;
      visiting.add(assetId);
      const valid = asset.dependencies.every(visit);
      visiting.delete(assetId);
      if (valid) visited.add(assetId);
      return valid;
    };

    for (const [index, asset] of manifest.assets.entries()) {
      for (const dependency of asset.dependencies) {
        if (!assets.has(dependency)) {
          context.addIssue({
            code: 'custom',
            message: 'Asset dependency is missing from the manifest',
            path: ['assets', index, 'dependencies'],
          });
        }
      }
      if (!visit(asset.assetId)) {
        context.addIssue({
          code: 'custom',
          message: 'Asset dependencies must be complete and acyclic',
          path: ['assets', index, 'dependencies'],
        });
      }
    }
  });

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
    alertMemoryMs: z.number().int().min(1000).max(15000).default(6000),
    nearMissRadius: z.number().min(16).max(160).default(64),
    allyAlertRadius: z.number().min(50).max(600).default(240),
    searchLeashRange: z.number().min(100).max(900).default(560),
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
  locale: localeSchema.default('en'),
});

export const submitAnswerRequestSchema = z.object({
  questionId: identifierSchema,
  selectedAnswerId: identifierSchema,
  locale: localeSchema.default('en'),
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
