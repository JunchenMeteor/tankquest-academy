import type { BlockPlacement, Vec3 } from './battle-scene-model.js';
import { stepEnemyToward } from './battle-scene-model.js';

export const ENEMY_STANDOFF = 9;
const FLANK_OFFSET = 7;

/** True when a straight line between two points crosses an obstacle. */
export function lineOfSightBlocked(
  from: { x: number; z: number },
  to: { x: number; z: number },
  blocks: readonly BlockPlacement[]
): boolean {
  const steps = 12;
  for (let step = 1; step < steps; step += 1) {
    const t = step / steps;
    const x = from.x + (to.x - from.x) * t;
    const z = from.z + (to.z - from.z) * t;
    for (const block of blocks) {
      if (
        Math.abs(x - block.position.x) <= block.size[0] / 2 &&
        Math.abs(z - block.position.z) <= block.size[2] / 2
      ) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Where an enemy wants to be.
 *
 * Without cover it takes the shortest approach, spread sideways by its slot so
 * a group does not stack into one line. When the straight line to the player is
 * blocked, it swings wide of the obstacle instead of grinding into it.
 */
export function enemyGoal(
  enemy: { position: Vec3 },
  player: { x: number; z: number },
  slot: number,
  count: number,
  blocks: readonly BlockPlacement[]
): { x: number; z: number } {
  const spread =
    count > 1 ? (slot - (count - 1) / 2) / Math.max(1, count - 1) : 0;
  const dx = player.x - enemy.position.x;
  const dz = player.z - enemy.position.z;
  const distance = Math.hypot(dx, dz) || 1;
  const forward = { x: dx / distance, z: dz / distance };
  const sideways = { x: -forward.z, z: forward.x };

  const blocked = lineOfSightBlocked(enemy.position, player, blocks);
  const lateral = spread * FLANK_OFFSET * (blocked ? 2.4 : 1);
  const range = blocked ? ENEMY_STANDOFF + 4 : ENEMY_STANDOFF;

  return {
    x: player.x - forward.x * range + sideways.x * lateral,
    z: player.z - forward.z * range + sideways.z * lateral,
  };
}

/** Moves an enemy toward its goal, clamped to the field. */
export function advanceEnemy(
  enemy: { position: Vec3 },
  goal: { x: number; z: number },
  speed: number,
  deltaSeconds: number,
  bounds: { width: number; depth: number }
): { position: Vec3; heading: number; moved: boolean } {
  const step = stepEnemyToward(enemy, goal, speed, deltaSeconds, 0.6, bounds);
  const heading =
    step.moved ||
    Math.hypot(goal.x - enemy.position.x, goal.z - enemy.position.z) > 0.6
      ? Math.atan2(-(goal.z - enemy.position.z), goal.x - enemy.position.x)
      : step.heading;
  return { position: step.position, heading, moved: step.moved };
}

/**
 * Difficulty scales how eagerly the group converges: easy enemies keep their
 * slots, harder ones aim for the same flank so they focus fire.
 */
export function groupSpread(
  slot: number,
  count: number,
  difficulty: number
): number {
  const tightness = Math.max(0, Math.min(1, difficulty));
  const spread =
    count > 1 ? (slot - (count - 1) / 2) / Math.max(1, count - 1) : 0;
  return spread * (1 - tightness * 0.75);
}
