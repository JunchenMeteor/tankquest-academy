/**
 * Projectile and hit rules for the 3D battle view.
 * Pure state transitions so combat can be tested without a renderer.
 */
import type { TankPlacement } from './battle-scene-model.js';

export interface Shell {
  id: number;
  x: number;
  z: number;
  heading: number;
  distanceTravelled: number;
}

export interface CombatState {
  shells: Shell[];
  enemiesRemaining: number;
  shotsFired: number;
  nextShellId: number;
  cooldownMs: number;
}

export const SHELL_SPEED = 42;
export const SHELL_RANGE = 30;
export const SHELL_RADIUS = 0.55;
export const FIRE_COOLDOWN_MS = 900;
export const ENEMY_HIT_RADIUS = 1.6;

export function createCombatState(enemyCount: number): CombatState {
  return {
    shells: [],
    enemiesRemaining: enemyCount,
    shotsFired: 0,
    nextShellId: 1,
    cooldownMs: 0,
  };
}

/** Spawns a shell from the turret tip so it does not start inside the hull. */
export function spawnShell(
  state: CombatState,
  muzzle: { x: number; z: number },
  heading: number
): CombatState {
  const shell: Shell = {
    id: state.nextShellId,
    x: muzzle.x,
    z: muzzle.z,
    heading,
    distanceTravelled: 0,
  };
  return {
    ...state,
    shells: [...state.shells, shell],
    shotsFired: state.shotsFired + 1,
    nextShellId: state.nextShellId + 1,
    cooldownMs: FIRE_COOLDOWN_MS,
  };
}

export interface AdvanceResult {
  state: CombatState;
  destroyed: string[];
}

/**
 * Moves every shell, drops the ones past range and resolves hits against the
 * first enemy whose centre falls inside the shell radius.
 */
export function advanceShells(
  state: CombatState,
  deltaSeconds: number,
  enemies: TankPlacement[],
  stepDistance = SHELL_SPEED
): AdvanceResult {
  const destroyed: string[] = [];
  const alive = new Set(enemies.map((enemy) => enemy.id));
  const remaining: Shell[] = [];

  for (const shell of state.shells) {
    const step = stepDistance * deltaSeconds;
    const nextX = shell.x + Math.cos(shell.heading) * step;
    const nextZ = shell.z - Math.sin(shell.heading) * step;
    const travelled = shell.distanceTravelled + step;

    let hitId: string | null = null;
    for (const enemy of enemies) {
      if (!alive.has(enemy.id)) continue;
      const dx = nextX - enemy.position.x;
      const dz = nextZ - enemy.position.z;
      if (Math.hypot(dx, dz) <= SHELL_RADIUS + ENEMY_HIT_RADIUS) {
        hitId = enemy.id;
        break;
      }
    }

    if (hitId) {
      alive.delete(hitId);
      destroyed.push(hitId);
      continue;
    }
    if (travelled > SHELL_RANGE) continue;
    remaining.push({
      ...shell,
      x: nextX,
      z: nextZ,
      distanceTravelled: travelled,
    });
  }

  return {
    state: {
      ...state,
      shells: remaining,
      enemiesRemaining: Math.max(0, state.enemiesRemaining - destroyed.length),
    },
    destroyed,
  };
}

/** Ticks the reload timer down; firing is only allowed at zero. */
export function tickCooldown(
  state: CombatState,
  deltaSeconds: number
): CombatState {
  if (state.cooldownMs <= 0) return state;
  return {
    ...state,
    cooldownMs: Math.max(0, state.cooldownMs - deltaSeconds * 1000),
  };
}

export function muzzlePoint(
  position: { x: number; z: number },
  heading: number,
  turret: number,
  barrelLength: number
): { x: number; z: number } {
  const angle = heading + turret;
  return {
    x: position.x + Math.cos(angle) * barrelLength,
    z: position.z - Math.sin(angle) * barrelLength,
  };
}
