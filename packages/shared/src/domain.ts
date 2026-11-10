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
  /** Base ratings are 1-5; purchased upgrades can raise effective ratings to 10. */
  accuracy: number;
  /** Higher effective traverse makes the gun swing faster. */
  turretTraverse: number;
}

export const tankBaseStatMax = 5;
export const tankStatMax = 10;
export const tankUpgradeMaxLevel = 5;
export const tankUpgradeCosts = [2, 4, 6, 8, 10] as const;

export const upgradeableStats = [
  'firepower',
  'mobility',
  'armor',
  'stealth',
  'vision',
  'accuracy',
  'turretTraverse',
] as const;
export type UpgradeableStat = (typeof upgradeableStats)[number];
export type TankUpgradeLevels = Record<UpgradeableStat, number>;

export function emptyTankUpgradeLevels(): TankUpgradeLevels {
  return {
    firepower: 0,
    mobility: 0,
    armor: 0,
    stealth: 0,
    vision: 0,
    accuracy: 0,
    turretTraverse: 0,
  };
}

export function tankUpgradeCost(currentLevel: number): number | null {
  if (
    !Number.isInteger(currentLevel) ||
    currentLevel < 0 ||
    currentLevel >= tankUpgradeMaxLevel
  ) {
    return null;
  }
  return tankUpgradeCosts[currentLevel] ?? null;
}

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
