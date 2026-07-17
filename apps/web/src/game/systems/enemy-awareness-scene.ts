import type Phaser from 'phaser';

import type { EnemyRuntimeConfig } from '../runtime/types.js';
import { logCombatEvent } from './combat-log.js';
import {
  alertEnemy,
  clampSearchTarget,
  type EnemyAction,
  type EnemyAwareness,
  effectiveEnemyDetectionRange,
  selectEnemyAction,
  shouldAlertFromProjectilePath,
  shouldShareEnemyAlert,
  updateEnemyAwareness,
} from './enemy-ai.js';

export interface EnemyAwarenessDecision {
  action: EnemyAction;
  targetPosition: { x: number; y: number };
  homePosition: { x: number; y: number };
}

export function createEnemyAwarenessData(enemy: EnemyRuntimeConfig) {
  return {
    awarenessState: 'patrol',
    alertUntil: 0,
    lastKnownX: undefined,
    lastKnownY: undefined,
    homeX: enemy.x,
    homeY: enemy.y,
    alertMemoryMs: enemy.alertMemoryMs,
    nearMissRadius: enemy.nearMissRadius,
    allyAlertRadius: enemy.allyAlertRadius,
    searchLeashRange: enemy.searchLeashRange,
  };
}

export function resolveEnemyAwarenessDecision(
  enemy: Phaser.Physics.Arcade.Sprite,
  time: number,
  playerPosition: { x: number; y: number },
  playerVisibilityMultiplier: number
): EnemyAwarenessDecision {
  const distance = pointDistance(enemy, playerPosition);
  const detectionRange = effectiveEnemyDetectionRange(
    enemy.getData('detectionRange') as number,
    playerVisibilityMultiplier
  );
  const homePosition = {
    x: enemy.getData('homeX') as number,
    y: enemy.getData('homeY') as number,
  };
  const previousAwareness = getEnemyAwareness(enemy);
  let awareness = updateEnemyAwareness(
    previousAwareness,
    time,
    distance <= detectionRange,
    playerPosition,
    enemy.getData('alertMemoryMs') as number
  );
  if (awareness.state === 'searching' && awareness.lastKnownPosition) {
    awareness = {
      ...awareness,
      lastKnownPosition: clampSearchTarget(
        homePosition,
        awareness.lastKnownPosition,
        enemy.getData('searchLeashRange') as number
      ),
    };
  }
  logAwarenessTransition(enemy, previousAwareness, awareness);
  setEnemyAwareness(enemy, awareness);
  return {
    action: selectEnemyAction(
      awareness.state,
      distance,
      enemy.getData('attackRange') as number
    ),
    targetPosition:
      awareness.state === 'engaged'
        ? playerPosition
        : (awareness.lastKnownPosition ?? homePosition),
    homePosition,
  };
}

export function alertEnemiesNearPlayerProjectiles(
  projectiles: Phaser.Physics.Arcade.Group,
  enemies: Phaser.Physics.Arcade.Group,
  time: number
) {
  for (const projectileChild of projectiles.children) {
    const projectile = projectileChild as Phaser.Physics.Arcade.Sprite;
    if (!projectile.active) continue;
    alertEnemiesAlongProjectilePath(projectile, enemies, time);
  }
}

export function alertEnemiesAlongProjectilePath(
  projectile: Phaser.Physics.Arcade.Sprite,
  enemies: Phaser.Physics.Arcade.Group,
  time: number
) {
  const alertedEnemyIds = new Set(
    (projectile.getData('alertedEnemyIds') as string[] | undefined) ?? []
  );
  const pathStart = {
    x: (projectile.getData('previousX') as number | undefined) ?? projectile.x,
    y: (projectile.getData('previousY') as number | undefined) ?? projectile.y,
  };
  const pathEnd = { x: projectile.x, y: projectile.y };
  const sourcePosition = projectileSourcePosition(projectile, pathStart);
  for (const enemyChild of enemies.children) {
    const enemy = enemyChild as Phaser.Physics.Arcade.Sprite;
    if (!enemy.active) continue;
    const enemyId = enemy.getData('id') as string;
    if (alertedEnemyIds.has(enemyId)) continue;
    if (
      !shouldAlertFromProjectilePath(
        pathStart,
        pathEnd,
        { x: enemy.x, y: enemy.y },
        enemy.getData('nearMissRadius') as number
      )
    ) {
      continue;
    }
    alertEnemySquad(enemies, enemy, time, sourcePosition, 'near_miss');
    alertedEnemyIds.add(enemyId);
  }
  projectile.setData('alertedEnemyIds', [...alertedEnemyIds]);
  projectile.setData({ previousX: projectile.x, previousY: projectile.y });
}

export function projectileSourcePosition(
  projectile: Phaser.Physics.Arcade.Sprite,
  fallback: { x: number; y: number }
) {
  return {
    x: (projectile.getData('sourceX') as number | undefined) ?? fallback.x,
    y: (projectile.getData('sourceY') as number | undefined) ?? fallback.y,
  };
}

export function alertEnemySquad(
  enemies: Phaser.Physics.Arcade.Group,
  sourceEnemy: Phaser.Physics.Arcade.Sprite,
  time: number,
  threatPosition: { x: number; y: number },
  reason: 'direct_hit' | 'near_miss'
) {
  let alertedCount = 0;
  for (const child of enemies.children) {
    const enemy = child as Phaser.Physics.Arcade.Sprite;
    if (!enemy.active) continue;
    const distance = pointDistance(sourceEnemy, enemy);
    if (
      !shouldShareEnemyAlert(
        distance,
        sourceEnemy.getData('allyAlertRadius') as number
      )
    ) {
      continue;
    }
    const previousAwareness = getEnemyAwareness(enemy);
    const constrainedThreatPosition = clampSearchTarget(
      {
        x: enemy.getData('homeX') as number,
        y: enemy.getData('homeY') as number,
      },
      threatPosition,
      enemy.getData('searchLeashRange') as number
    );
    setEnemyAwareness(
      enemy,
      alertEnemy(
        previousAwareness,
        time,
        constrainedThreatPosition,
        enemy.getData('alertMemoryMs') as number
      )
    );
    if (previousAwareness.state === 'patrol') alertedCount += 1;
  }
  if (alertedCount > 0) {
    logCombatEvent('enemy_squad_alerted', {
      enemyId: sourceEnemy.getData('id') as string,
      reason,
      alertedCount,
    });
  }
}

function getEnemyAwareness(
  enemy: Phaser.Physics.Arcade.Sprite
): EnemyAwareness {
  const lastKnownX = enemy.getData('lastKnownX') as number | undefined;
  const lastKnownY = enemy.getData('lastKnownY') as number | undefined;
  return {
    state:
      (enemy.getData('awarenessState') as
        EnemyAwareness['state'] | undefined) ?? 'patrol',
    alertUntil: (enemy.getData('alertUntil') as number | undefined) ?? 0,
    lastKnownPosition:
      lastKnownX === undefined || lastKnownY === undefined
        ? undefined
        : { x: lastKnownX, y: lastKnownY },
  };
}

function setEnemyAwareness(
  enemy: Phaser.Physics.Arcade.Sprite,
  awareness: EnemyAwareness
) {
  enemy.setData({
    awarenessState: awareness.state,
    alertUntil: awareness.alertUntil,
    lastKnownX: awareness.lastKnownPosition?.x,
    lastKnownY: awareness.lastKnownPosition?.y,
  });
}

function logAwarenessTransition(
  enemy: Phaser.Physics.Arcade.Sprite,
  previous: EnemyAwareness,
  next: EnemyAwareness
) {
  if (previous.state === next.state) return;
  const enemyId = enemy.getData('id') as string;
  if (next.state === 'engaged') {
    logCombatEvent('enemy_engaged', { enemyId });
  } else if (previous.state === 'searching' && next.state === 'patrol') {
    logCombatEvent('enemy_awareness_expired', { enemyId });
  }
}

function pointDistance(
  first: { x: number; y: number },
  second: { x: number; y: number }
) {
  return Math.hypot(first.x - second.x, first.y - second.y);
}
