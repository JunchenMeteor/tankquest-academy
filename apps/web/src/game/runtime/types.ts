import type { AssetBundle } from '../../client/assets/index.js';
import type { LevelObjectiveSetDto } from '@tankquest/shared';

export type ArmorZone = 'front' | 'side' | 'rear';

export interface ArmorProfile {
  front: number;
  side: number;
  rear: number;
}

export interface PlayerCombatRuntimeConfig {
  maxHealth: number;
  armorReduction: number;
  armorProfile: ArmorProfile;
  mass: number;
  speed: number;
  reverseSpeed: number;
  acceleration: number;
  turnSpeed: number;
  projectileDamage: number;
  projectilePenetration: number;
  projectileSpeed: number;
  fireCooldownMs: number;
  detectionRange: number;
  visibilityMultiplier: number;
}

export interface PlayerRuntimeConfig extends PlayerCombatRuntimeConfig {
  visualCode: string;
  appearance?: { primaryColor: number; secondaryColor: number };
}

export interface EnemyRuntimeConfig {
  id: string;
  role: 'scout' | 'medium' | 'heavy';
  elite: boolean;
  x: number;
  y: number;
  maxHealth: number;
  armorReduction: number;
  armorProfile: ArmorProfile;
  mass: number;
  speed: number;
  detectionRange: number;
  attackRange: number;
  projectileDamage: number;
  projectilePenetration: number;
  projectileSpeed: number;
  fireCooldownMs: number;
  alertMemoryMs: number;
  nearMissRadius: number;
  allyAlertRadius: number;
  searchLeashRange: number;
}

export interface ObstacleRuntimeConfig {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RuntimeLevelConfig {
  locale: 'en' | 'zh-CN';
  theme: 'training-base' | 'forest-camp' | 'snow-field';
  width: number;
  height: number;
  mapStyle: 'range' | 'gate' | 'patrol';
  playerSpawn: { x: number; y: number };
  player: PlayerRuntimeConfig;
  enemies: EnemyRuntimeConfig[];
  obstacles: ObstacleRuntimeConfig[];
  objectiveSet: LevelObjectiveSetDto;
  visualResources?: AssetBundle;
}

export interface RuntimeState {
  enemiesRemaining: number;
  shotsFired: number;
  playerHealth: number;
  playerMaxHealth: number;
  playerDestroyed: boolean;
  objectiveComplete: boolean;
  objectiveType:
    'eliminate' | 'defend-waves' | 'supply-run' | 'route-choice' | 'elite-hunt';
  objectiveCurrent: number;
  objectiveTarget: number;
}
