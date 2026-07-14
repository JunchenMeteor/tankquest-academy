export type EnemyAction = 'idle' | 'chase' | 'fire';

export function effectiveEnemyDetectionRange(
  configuredRange: number,
  playerVisibilityMultiplier: number
) {
  return Math.max(0, configuredRange * playerVisibilityMultiplier);
}

export function selectEnemyAction(
  distance: number,
  detectionRange: number,
  attackRange: number
): EnemyAction {
  if (distance > detectionRange) return 'idle';
  if (distance > attackRange) return 'chase';
  return 'fire';
}

export function canEnemyFire(
  lastShotAt: number,
  now: number,
  fireCooldownMs: number
) {
  return now - lastShotAt >= fireCooldownMs;
}
