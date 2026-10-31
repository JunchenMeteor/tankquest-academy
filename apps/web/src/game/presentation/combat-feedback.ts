export const combatFeedbackCues = [
  'fire',
  'reload-ready',
  'ricochet',
  'blocked',
  'penetrated',
  'low-health',
  'destroyed',
] as const;

export type CombatFeedbackCue = (typeof combatFeedbackCues)[number];

export type CombatFeedbackShape =
  | 'muzzle-cone'
  | 'ready-ring'
  | 'spark-streak'
  | 'armor-ripple'
  | 'impact-shards'
  | 'warning-vignette'
  | 'blast-ring';

export type CombatFeedbackMotion =
  'recoil' | 'pulse' | 'deflect' | 'expand' | 'burst' | 'breathe' | 'explode';

export interface CombatFeedbackDefinition {
  readonly color: number;
  readonly secondaryColor: number;
  readonly shape: CombatFeedbackShape;
  readonly motion: CombatFeedbackMotion;
  readonly durationMs: number;
  readonly particleCount: number;
  readonly travelPixels: number;
  readonly cameraShake: number;
  readonly volume: number;
}

export const COMBAT_FEEDBACK_LIMITS = {
  durationMs: { min: 80, max: 650 },
  particleCount: { min: 0, max: 12 },
  travelPixels: { min: 0, max: 48 },
  cameraShake: { min: 0, max: 0.008 },
  volume: { min: 0, max: 0.8 },
} as const;

export const LOW_HEALTH_RATIO = 0.35;

const definitions: Readonly<
  Record<CombatFeedbackCue, CombatFeedbackDefinition>
> = {
  fire: {
    color: 0xfff0a3,
    secondaryColor: 0xff8b48,
    shape: 'muzzle-cone',
    motion: 'recoil',
    durationMs: 120,
    particleCount: 4,
    travelPixels: 8,
    cameraShake: 0.002,
    volume: 0.55,
  },
  'reload-ready': {
    color: 0x9ee7ff,
    secondaryColor: 0xf4fbff,
    shape: 'ready-ring',
    motion: 'pulse',
    durationMs: 240,
    particleCount: 0,
    travelPixels: 0,
    cameraShake: 0,
    volume: 0.28,
  },
  ricochet: {
    color: 0x9ee7ff,
    secondaryColor: 0xffffff,
    shape: 'spark-streak',
    motion: 'deflect',
    durationMs: 260,
    particleCount: 7,
    travelPixels: 36,
    cameraShake: 0.001,
    volume: 0.42,
  },
  blocked: {
    color: 0xffe08a,
    secondaryColor: 0xb99745,
    shape: 'armor-ripple',
    motion: 'expand',
    durationMs: 320,
    particleCount: 5,
    travelPixels: 18,
    cameraShake: 0.0015,
    volume: 0.46,
  },
  penetrated: {
    color: 0xffd7cf,
    secondaryColor: 0xff6d4a,
    shape: 'impact-shards',
    motion: 'burst',
    durationMs: 380,
    particleCount: 9,
    travelPixels: 30,
    cameraShake: 0.0035,
    volume: 0.58,
  },
  'low-health': {
    color: 0xf36b5c,
    secondaryColor: 0x721f24,
    shape: 'warning-vignette',
    motion: 'breathe',
    durationMs: 650,
    particleCount: 0,
    travelPixels: 0,
    cameraShake: 0,
    volume: 0.5,
  },
  destroyed: {
    color: 0xffb347,
    secondaryColor: 0x4f2420,
    shape: 'blast-ring',
    motion: 'explode',
    durationMs: 480,
    particleCount: 12,
    travelPixels: 48,
    cameraShake: 0.007,
    volume: 0.72,
  },
};

export function combatFeedbackDefinition(
  cue: CombatFeedbackCue
): CombatFeedbackDefinition {
  return definitions[cue];
}

export function crossedLowHealthThreshold(
  previousHealth: number,
  nextHealth: number,
  maxHealth: number
) {
  if (
    !Number.isFinite(previousHealth) ||
    !Number.isFinite(nextHealth) ||
    !Number.isFinite(maxHealth) ||
    maxHealth <= 0 ||
    nextHealth <= 0
  ) {
    return false;
  }

  const previousRatio = clamp(previousHealth / maxHealth, 0, 1);
  const nextRatio = clamp(nextHealth / maxHealth, 0, 1);
  return previousRatio > LOW_HEALTH_RATIO && nextRatio <= LOW_HEALTH_RATIO;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}
