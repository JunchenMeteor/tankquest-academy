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
}

export const tankStatMax = 5;

export const enemyTankRoles = ['scout', 'medium', 'heavy'] as const;
export type EnemyTankRole = (typeof enemyTankRoles)[number];
