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

export interface EnemyShell {
  id: number;
  x: number;
  z: number;
  heading: number;
  damage: number;
  distanceTravelled: number;
}

export interface CombatState {
  shells: Shell[];
  enemyShells: EnemyShell[];
  enemiesRemaining: number;
  shotsFired: number;
  nextShellId: number;
  cooldownMs: number;
  ammo: number;
  enemyCooldowns: Record<string, number>;
  playerHealth: number;
  playerMaxHealth: number;
  playerDestroyed: boolean;
}

export const SHELL_SPEED = 42;
export const SHELL_RANGE = 30;
export const SHELL_RADIUS = 0.55;
export const FIRE_COOLDOWN_MS = 900;
export const ENEMY_HIT_RADIUS = 1.6;
export const MAX_AMMO = 5;
export const WRONG_ANSWER_PENALTY_MS = 2500;
export const ENEMY_FIRE_INTERVAL_MS = 3200;
export const ENEMY_FIRE_RANGE = 22;
export const PLAYER_HIT_RADIUS = 1.7;

export function createCombatState(
  enemyCount: number,
  ammo = 1,
  playerHealth = 150
): CombatState {
  return {
    shells: [],
    enemyShells: [],
    enemiesRemaining: enemyCount,
    shotsFired: 0,
    nextShellId: 1,
    cooldownMs: 0,
    ammo: Math.min(MAX_AMMO, Math.max(0, ammo)),
    enemyCooldowns: {},
    playerHealth,
    playerMaxHealth: playerHealth,
    playerDestroyed: false,
  };
}

export interface EnemyLaunch {
  x: number;
  z: number;
  heading: number;
  damage: number;
  sourceId: string;
}

/**
 * Ticks every enemy's reload and returns the enemies that open fire this frame.
 * Enemies only shoot when the player is inside their range.
 */
export function advanceEnemyFire(
  state: CombatState,
  enemies: TankPlacement[],
  player: { x: number; z: number },
  deltaSeconds: number,
  damage = 9
): { state: CombatState; launches: EnemyLaunch[] } {
  if (state.playerDestroyed) return { state, launches: [] };
  const cooldowns: Record<string, number> = { ...state.enemyCooldowns };
  const launches: EnemyLaunch[] = [];

  for (const enemy of enemies) {
    const next = Math.max(0, (cooldowns[enemy.id] ?? 0) - deltaSeconds * 1000);
    cooldowns[enemy.id] = next;
    const distance = Math.hypot(
      player.x - enemy.position.x,
      player.z - enemy.position.z
    );
    if (distance > ENEMY_FIRE_RANGE || next > 0) continue;
    cooldowns[enemy.id] = ENEMY_FIRE_INTERVAL_MS;
    launches.push({
      x: enemy.position.x,
      z: enemy.position.z,
      heading: Math.atan2(
        -(player.z - enemy.position.z),
        player.x - enemy.position.x
      ),
      damage,
      sourceId: enemy.id,
    });
  }

  return {
    state: { ...state, enemyCooldowns: cooldowns },
    launches,
  };
}

export function spawnEnemyShell(
  state: CombatState,
  launch: EnemyLaunch
): CombatState {
  const shell: EnemyShell = {
    id: state.nextShellId,
    x: launch.x,
    z: launch.z,
    heading: launch.heading,
    damage: launch.damage,
    distanceTravelled: 0,
  };
  return {
    ...state,
    enemyShells: [...state.enemyShells, shell],
    nextShellId: state.nextShellId + 1,
  };
}

/** Moves incoming shells and applies the damage of the ones that reach the player. */
export function advanceEnemyShells(
  state: CombatState,
  deltaSeconds: number,
  player: { x: number; z: number },
  stepDistance = SHELL_SPEED
): { state: CombatState; damage: number } {
  if (state.enemyShells.length === 0) return { state, damage: 0 };
  const remaining: EnemyShell[] = [];
  let damage = 0;

  for (const shell of state.enemyShells) {
    const step = stepDistance * deltaSeconds;
    const nextX = shell.x + Math.cos(shell.heading) * step;
    const nextZ = shell.z - Math.sin(shell.heading) * step;
    const travelled = shell.distanceTravelled + step;
    if (Math.hypot(nextX - player.x, nextZ - player.z) <= PLAYER_HIT_RADIUS) {
      damage += shell.damage;
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

  const health = Math.max(0, state.playerHealth - damage);
  return {
    state: {
      ...state,
      enemyShells: remaining,
      playerHealth: health,
      playerDestroyed: health === 0,
    },
    damage,
  };
}

/** A correct answer loads the reward the backend granted, capped by the magazine. */
export function loadAmmo(state: CombatState, amount: number): CombatState {
  if (amount <= 0) return state;
  return { ...state, ammo: Math.min(MAX_AMMO, state.ammo + amount) };
}

/** A wrong answer costs time rather than a round, so the child can keep trying. */
export function applyWrongAnswer(state: CombatState): CombatState {
  return { ...state, cooldownMs: state.cooldownMs + WRONG_ANSWER_PENALTY_MS };
}

export function canFire(state: CombatState): boolean {
  return state.ammo > 0 && state.cooldownMs === 0;
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
    ammo: Math.max(0, state.ammo - 1),
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
