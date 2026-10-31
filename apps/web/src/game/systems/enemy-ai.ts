export const ENEMY_SEARCH_STOP_DISTANCE = 24;

export type EnemyAction = 'idle' | 'chase' | 'fire' | 'search';
export type EnemyAwarenessState = 'patrol' | 'engaged' | 'searching';

export interface Point {
  x: number;
  y: number;
}

export interface EnemyAwareness {
  state: EnemyAwarenessState;
  alertUntil: number;
  lastKnownPosition?: Point;
}

export function createEnemyAwareness(): EnemyAwareness {
  return { state: 'patrol', alertUntil: 0 };
}

export function effectiveEnemyDetectionRange(
  configuredRange: number,
  playerVisibilityMultiplier: number
) {
  return Math.max(0, configuredRange * playerVisibilityMultiplier);
}

export function updateEnemyAwareness(
  awareness: EnemyAwareness,
  now: number,
  passivelyDetected: boolean,
  playerPosition: Point,
  alertMemoryMs: number
): EnemyAwareness {
  if (passivelyDetected) {
    return {
      state: 'engaged',
      alertUntil: now + alertMemoryMs,
      lastKnownPosition: { ...playerPosition },
    };
  }
  if (
    awareness.lastKnownPosition &&
    awareness.state !== 'patrol' &&
    now < awareness.alertUntil
  ) {
    return { ...awareness, state: 'searching' };
  }
  return createEnemyAwareness();
}

export function alertEnemy(
  awareness: EnemyAwareness,
  now: number,
  threatPosition: Point,
  alertMemoryMs: number
): EnemyAwareness {
  return {
    state: awareness.state === 'engaged' ? 'engaged' : 'searching',
    alertUntil: Math.max(awareness.alertUntil, now + alertMemoryMs),
    lastKnownPosition: { ...threatPosition },
  };
}

export function selectEnemyAction(
  awarenessState: EnemyAwarenessState,
  distance: number,
  attackRange: number
): EnemyAction {
  if (awarenessState === 'patrol') return 'idle';
  if (awarenessState === 'searching') return 'search';
  if (distance > attackRange) return 'chase';
  return 'fire';
}

export function shouldAlertFromProjectilePath(
  pathStart: Point,
  pathEnd: Point,
  enemyPosition: Point,
  radius: number
) {
  return distanceToSegment(enemyPosition, pathStart, pathEnd) <= radius;
}

export function shouldShareEnemyAlert(distance: number, radius: number) {
  return distance <= radius;
}

export function shouldContinueSearch(
  distanceToTarget: number,
  stopDistance = ENEMY_SEARCH_STOP_DISTANCE
) {
  return distanceToTarget > stopDistance;
}

export function clampSearchTarget(
  homePosition: Point,
  threatPosition: Point,
  leashRange: number
): Point {
  const offsetX = threatPosition.x - homePosition.x;
  const offsetY = threatPosition.y - homePosition.y;
  const distance = Math.hypot(offsetX, offsetY);
  if (distance <= leashRange || distance === 0) return { ...threatPosition };
  const scale = leashRange / distance;
  return {
    x: homePosition.x + offsetX * scale,
    y: homePosition.y + offsetY * scale,
  };
}

export function canEnemyFire(
  lastShotAt: number,
  now: number,
  fireCooldownMs: number
) {
  return now - lastShotAt >= fireCooldownMs;
}

function distanceToSegment(point: Point, start: Point, end: Point) {
  const segmentX = end.x - start.x;
  const segmentY = end.y - start.y;
  const lengthSquared = segmentX * segmentX + segmentY * segmentY;
  if (lengthSquared === 0)
    return Math.hypot(point.x - start.x, point.y - start.y);
  const projection = Math.max(
    0,
    Math.min(
      1,
      ((point.x - start.x) * segmentX + (point.y - start.y) * segmentY) /
        lengthSquared
    )
  );
  const closestX = start.x + projection * segmentX;
  const closestY = start.y + projection * segmentY;
  return Math.hypot(point.x - closestX, point.y - closestY);
}
