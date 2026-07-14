export interface PlayerRuntimeConfig {
  maxHealth: number;
  armorReduction: number;
  mass: number;
  speed: number;
  reverseSpeed: number;
  acceleration: number;
  turnSpeed: number;
  projectileDamage: number;
  projectileSpeed: number;
  fireCooldownMs: number;
  detectionRange: number;
  visibilityMultiplier: number;
}

export interface EnemyRuntimeConfig {
  id: string;
  x: number;
  y: number;
  speed: number;
  detectionRange: number;
}

export interface ObstacleRuntimeConfig {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RuntimeLevelConfig {
  width: number;
  height: number;
  player: PlayerRuntimeConfig;
  enemies: EnemyRuntimeConfig[];
  obstacles: ObstacleRuntimeConfig[];
}

export interface RuntimeState {
  enemiesRemaining: number;
  shotsFired: number;
}
