export const ageGroups = ['child_6_8', 'child_9_12', 'teen', 'adult'] as const;
export type AgeGroup = (typeof ageGroups)[number];

export const gameModes = [
  'child_learning',
  'teen_challenge',
  'adult_casual',
  'parent_management',
] as const;
export type GameMode = (typeof gameModes)[number];

export const subjects = [
  'math',
  'english',
  'direction',
  'logic',
  'physics',
] as const;
export type Subject = (typeof subjects)[number];

export const sessionStatuses = ['active', 'finished', 'abandoned'] as const;
export type SessionStatus = (typeof sessionStatuses)[number];

export interface TankStats {
  firepower: number;
  mobility: number;
  armor: number;
  stealth: number;
  vision: number;
  /** Gun accuracy on the same 1-5 scale; higher means a tighter shell spread. */
  accuracy: number;
  /** Turret traverse on the same 1-5 scale; higher means the gun swings faster. */
  turretTraverse: number;
}

export const tankStatMax = 5;

/** Stats that parts can upgrade. Accuracy and traverse stay fixed per tank. */
export const upgradeableStats = [
  'firepower',
  'mobility',
  'armor',
  'stealth',
  'vision',
] as const;
export type UpgradeableStat = (typeof upgradeableStats)[number];

export const enemyTankRoles = ['scout', 'medium', 'heavy'] as const;
export type EnemyTankRole = (typeof enemyTankRoles)[number];

export const trainingMapStyles = ['range', 'gate', 'patrol'] as const;
export type TrainingMapStyle = (typeof trainingMapStyles)[number];

export const assetTypes = [
  'scene-description',
  'tank-visuals',
  'theme-texture',
  'sound-effect',
] as const;
export type AssetType = (typeof assetTypes)[number];
