/**
 * Projectile and hit rules for the 3D battle view.
 * Pure state transitions so combat can be tested without a renderer.
 */
import { calculateArmoredDamage } from '../systems/combat-damage.js';
import {
  calculateProjectileImpact,
  classifyArmorZone,
} from '../systems/projectile-impact.js';
import type { ArmorProfile, ArmorZone } from '../runtime/types.js';
import type { TankPlacement } from './battle-scene-model.js';

export interface Shell {
  id: number;
  x: number;
  y: number;
  z: number;
  heading: number;
  pitch: number;
  damage: number;
  penetration: number;
  distanceTravelled: number;
}

export interface EnemyShell {
  id: number;
  x: number;
  y: number;
  z: number;
  heading: number;
  pitch: number;
  damage: number;
  penetration?: number;
  speed: number;
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
  playerAmmoRackHealth: number;
  enemyHealth: Record<string, number>;
  ammoRackHealth: Record<string, number>;
  /** Time banked toward the next automatically loaded shell. */
  reloadMs: number;
}

export const SHELL_SPEED = 42;
export const SHELL_RANGE = 46;
export const SHELL_RADIUS = 0.55;
export const FIRE_COOLDOWN_MS = 900;
export const ENEMY_HIT_RADIUS = 1.6;
export const MAX_AMMO = 5;
export const WRONG_ANSWER_PENALTY_MS = 2500;
export const ENEMY_FIRE_INTERVAL_MS = 3200;
export const ENEMY_FIRE_RANGE = 34;
export const PLAYER_HIT_RADIUS = 1.7;
/** A shell slides into the breech on its own this often. */
export const AUTO_RELOAD_MS = 2600;

function ammoRackCapacity(maxHealth: number): number {
  return Math.max(30, Math.round(maxHealth * 0.35));
}

function isCriticalHit(zone: ArmorZone, roll: number): boolean {
  const chance = zone === 'rear' ? 0.24 : zone === 'side' ? 0.14 : 0.08;
  return roll < chance;
}

export function createCombatState(
  enemyCount: number,
  ammo = 1,
  playerHealth = 150,
  enemies: TankPlacement[] = []
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
    playerAmmoRackHealth: ammoRackCapacity(playerHealth),
    enemyHealth: Object.fromEntries(
      enemies.map((enemy) => [enemy.id, enemy.combat?.maxHealth ?? 100])
    ),
    ammoRackHealth: Object.fromEntries(
      enemies.map((enemy) => [
        enemy.id,
        ammoRackCapacity(enemy.combat?.maxHealth ?? 100),
      ])
    ),
    reloadMs: 0,
  };
}

export interface EnemyLaunch {
  x: number;
  y?: number;
  z: number;
  heading: number;
  pitch?: number;
  damage: number;
  projectilePenetration?: number;
  projectileSpeed?: number;
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
  damage = 9,
  /** Reload between shots; a harder fight shortens it. */
  intervalMs = ENEMY_FIRE_INTERVAL_MS
): { state: CombatState; launches: EnemyLaunch[] } {
  if (state.playerDestroyed) return { state, launches: [] };
  const cooldowns: Record<string, number> = { ...state.enemyCooldowns };
  const launches: EnemyLaunch[] = [];

  for (const enemy of enemies) {
    if (enemy.passive) continue;
    const next = Math.max(0, (cooldowns[enemy.id] ?? 0) - deltaSeconds * 1000);
    cooldowns[enemy.id] = next;
    const distance = Math.hypot(
      player.x - enemy.position.x,
      player.z - enemy.position.z
    );
    if (distance > ENEMY_FIRE_RANGE || next > 0) continue;
    cooldowns[enemy.id] = enemy.combat?.fireCooldownMs ?? intervalMs;
    launches.push({
      x: enemy.position.x,
      z: enemy.position.z,
      heading: Math.atan2(
        -(player.z - enemy.position.z),
        player.x - enemy.position.x
      ),
      damage: enemy.combat?.projectileDamage ?? damage,
      projectilePenetration: enemy.combat?.projectilePenetration,
      projectileSpeed: enemy.combat?.projectileSpeed,
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
    y: launch.y ?? 0.9,
    z: launch.z,
    heading: launch.heading,
    pitch: launch.pitch ?? 0,
    damage: launch.damage,
    penetration: launch.projectilePenetration,
    speed: (launch.projectileSpeed ?? SHELL_SPEED * 10) * 0.1,
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
  armorReduction = 0,
  armorProfile?: ArmorProfile,
  playerHeading = 0,
  criticalRoll: () => number = () => 1
): { state: CombatState; damage: number; impacts: ShellImpact[] } {
  if (state.enemyShells.length === 0) {
    return { state, damage: 0, impacts: [] };
  }
  const remaining: EnemyShell[] = [];
  const impacts: ShellImpact[] = [];
  let ammoRackHealth = state.playerAmmoRackHealth;
  let damage = 0;

  for (const shell of state.enemyShells) {
    const step = shell.speed * deltaSeconds;
    const horizontal = Math.cos(shell.pitch);
    const nextX = shell.x + Math.cos(shell.heading) * step * horizontal;
    const nextY = shell.y - Math.sin(shell.pitch) * step;
    const nextZ = shell.z - Math.sin(shell.heading) * step * horizontal;
    const travelled = shell.distanceTravelled + step;
    if (Math.hypot(nextX - player.x, nextZ - player.z) <= PLAYER_HIT_RADIUS) {
      const from = { x: shell.x, y: shell.y, z: shell.z };
      const to = { x: nextX, y: nextY, z: nextZ };
      const fraction = sweepFraction(
        from,
        to,
        { x: player.x, y: nextY, z: player.z },
        PLAYER_HIT_RADIUS
      );
      const point = {
        x: shell.x + (nextX - shell.x) * (fraction ?? 0),
        y: nextY,
        z: shell.z + (nextZ - shell.z) * (fraction ?? 0),
      };
      const zone = classifyArmorZone(
        point.x - player.x,
        point.z - player.z,
        -playerHeading
      );
      const impact =
        armorProfile && shell.penetration !== undefined
          ? calculateProjectileImpact({
              armor: armorProfile,
              baseDamage: shell.damage,
              impactOffsetX: point.x - player.x,
              impactOffsetY: point.z - player.z,
              penetration: shell.penetration,
              projectileVelocityX: Math.cos(shell.heading) * horizontal,
              projectileVelocityY: -Math.sin(shell.heading) * horizontal,
              targetRotation: -playerHeading,
            })
          : null;
      const critical =
        impact?.outcome === 'penetrated' && isCriticalHit(zone, criticalRoll());
      ammoRackHealth = Math.max(
        0,
        ammoRackHealth -
          (critical ? Math.max(1, Math.round(shell.damage * 0.65)) : 0)
      );
      const explosion = critical && ammoRackHealth === 0;
      const impactDamage = critical
        ? 0
        : calculateArmoredDamage(
            impact?.damage ?? shell.damage,
            armorReduction
          );
      damage += impactDamage;
      impacts.push({
        enemyId: 'player',
        point,
        damage: impactDamage,
        zone,
        impactAngleDegrees: impact?.impactAngleDegrees ?? 0,
        ammoRackRemaining: ammoRackHealth,
        outcome: explosion
          ? 'ammo-explosion'
          : critical
            ? 'critical'
            : (impact?.outcome ?? 'penetrated'),
      });
      continue;
    }
    if (travelled > SHELL_RANGE) continue;
    remaining.push({
      ...shell,
      x: nextX,
      y: nextY,
      z: nextZ,
      distanceTravelled: travelled,
    });
  }

  const explosion = impacts.some(
    (impact) => impact.outcome === 'ammo-explosion'
  );
  const health = explosion ? 0 : Math.max(0, state.playerHealth - damage);
  return {
    state: {
      ...state,
      enemyShells: remaining,
      playerHealth: health,
      playerAmmoRackHealth: ammoRackHealth,
      playerDestroyed: health === 0,
    },
    damage,
    impacts,
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
  heading: number,
  pitch = 0,
  height = 1.2,
  damage = 34,
  penetration = 82,
  cooldownMs = FIRE_COOLDOWN_MS
): CombatState {
  const shell: Shell = {
    id: state.nextShellId,
    x: muzzle.x,
    y: height,
    z: muzzle.z,
    heading,
    pitch,
    damage,
    penetration,
    distanceTravelled: 0,
  };
  return {
    ...state,
    shells: [...state.shells, shell],
    shotsFired: state.shotsFired + 1,
    nextShellId: state.nextShellId + 1,
    cooldownMs,
    ammo: Math.max(0, state.ammo - 1),
  };
}

export interface ShellImpact {
  enemyId: string;
  point: { x: number; y: number; z: number };
  damage: number;
  zone: ArmorZone;
  impactAngleDegrees: number;
  ammoRackRemaining: number;
  outcome:
    'ricochet' | 'blocked' | 'penetrated' | 'critical' | 'ammo-explosion';
}

export interface AdvanceResult {
  state: CombatState;
  destroyed: string[];
  impacts: ShellImpact[];
}

export interface ShellHit {
  enemy: TankPlacement;
  fraction: number;
  point: { x: number; y: number; z: number };
}

export type ShellHitTest = (
  from: { x: number; y: number; z: number },
  to: { x: number; y: number; z: number },
  enemies: TankPlacement[]
) => ShellHit | null;

function sweepFraction(
  from: { x: number; y: number; z: number },
  to: { x: number; y: number; z: number },
  centre: { x: number; y: number; z: number },
  radius: number
): number | null {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dz = to.z - from.z;
  const lengthSquared = dx * dx + dy * dy + dz * dz;
  if (lengthSquared === 0) return null;
  const fraction = Math.max(
    0,
    Math.min(
      1,
      ((centre.x - from.x) * dx +
        (centre.y - from.y) * dy +
        (centre.z - from.z) * dz) /
        lengthSquared
    )
  );
  const x = from.x + dx * fraction - centre.x;
  const y = from.y + dy * fraction - centre.y;
  const z = from.z + dz * fraction - centre.z;
  const distance = Math.hypot(x, y, z);
  if (distance > radius) return null;
  const entry =
    fraction -
    Math.sqrt(radius * radius - distance * distance) / Math.sqrt(lengthSquared);
  return Math.max(0, entry);
}

const sphereHitTest: ShellHitTest = (from, to, enemies) => {
  let nearest: ShellHit | null = null;
  for (const enemy of enemies) {
    const fraction = sweepFraction(
      from,
      to,
      {
        x: enemy.position.x,
        y: enemy.position.y + 1.2,
        z: enemy.position.z,
      },
      SHELL_RADIUS + ENEMY_HIT_RADIUS
    );
    if (fraction === null || (nearest && fraction >= nearest.fraction))
      continue;
    nearest = {
      enemy,
      fraction,
      point: {
        x: from.x + (to.x - from.x) * fraction,
        y: from.y + (to.y - from.y) * fraction,
        z: from.z + (to.z - from.z) * fraction,
      },
    };
  }
  return nearest;
};

/**
 * Sweeps shells between fixed-step positions, then applies penetration,
 * directional armor, and health instead of deleting a tank on any hit.
 */
export function advanceShells(
  state: CombatState,
  deltaSeconds: number,
  enemies: TankPlacement[],
  stepDistance = SHELL_SPEED,
  hitTest: ShellHitTest = sphereHitTest,
  criticalRoll: () => number = () => 1
): AdvanceResult {
  const destroyed: string[] = [];
  const impacts: ShellImpact[] = [];
  const alive = new Set(enemies.map((enemy) => enemy.id));
  const remaining: Shell[] = [];
  const enemyHealth = { ...state.enemyHealth };
  const ammoRackHealth = { ...state.ammoRackHealth };

  for (const shell of state.shells) {
    const step = stepDistance * deltaSeconds;
    const horizontal = Math.cos(shell.pitch);
    const nextX = shell.x + Math.cos(shell.heading) * step * horizontal;
    const nextY = shell.y - Math.sin(shell.pitch) * step;
    const nextZ = shell.z - Math.sin(shell.heading) * step * horizontal;
    const travelled = shell.distanceTravelled + step;
    const from = { x: shell.x, y: shell.y, z: shell.z };
    const to = { x: nextX, y: nextY, z: nextZ };
    const hit = hitTest(
      from,
      to,
      enemies.filter((enemy) => alive.has(enemy.id))
    );

    if (hit) {
      const enemy = hit.enemy;
      const armor = enemy.combat?.armorProfile ?? {
        front: 54,
        side: 42,
        rear: 32,
      };
      const zone = classifyArmorZone(
        hit.point.x - enemy.position.x,
        hit.point.z - enemy.position.z,
        -enemy.heading
      );
      const impact = calculateProjectileImpact({
        armor,
        baseDamage: shell.damage,
        impactOffsetX: hit.point.x - enemy.position.x,
        impactOffsetY: hit.point.z - enemy.position.z,
        penetration: shell.penetration,
        projectileVelocityX: Math.cos(shell.heading) * horizontal,
        projectileVelocityY: -Math.sin(shell.heading) * horizontal,
        targetRotation: -enemy.heading,
      });
      const critical =
        impact.outcome === 'penetrated' && isCriticalHit(zone, criticalRoll());
      const rackRemaining = Math.max(
        0,
        (ammoRackHealth[enemy.id] ??
          ammoRackCapacity(enemy.combat?.maxHealth ?? 100)) -
          (critical ? Math.max(1, Math.round(shell.damage * 0.65)) : 0)
      );
      ammoRackHealth[enemy.id] = rackRemaining;
      const explosion = critical && rackRemaining === 0;
      const damage = critical
        ? 0
        : calculateArmoredDamage(
            impact.damage,
            enemy.combat?.armorReduction ?? 0
          );
      const health = explosion
        ? 0
        : Math.max(
            0,
            (enemyHealth[enemy.id] ?? enemy.combat?.maxHealth ?? 100) - damage
          );
      enemyHealth[enemy.id] = health;
      impacts.push({
        enemyId: enemy.id,
        point: hit.point,
        damage,
        zone,
        impactAngleDegrees: impact.impactAngleDegrees,
        ammoRackRemaining: rackRemaining,
        outcome: explosion
          ? 'ammo-explosion'
          : critical
            ? 'critical'
            : impact.outcome,
      });
      if (health === 0) {
        alive.delete(enemy.id);
        destroyed.push(enemy.id);
      }
      continue;
    }
    if (travelled > SHELL_RANGE) continue;
    remaining.push({
      ...shell,
      x: nextX,
      y: nextY,
      z: nextZ,
      distanceTravelled: travelled,
    });
  }

  return {
    state: {
      ...state,
      shells: remaining,
      enemyHealth,
      ammoRackHealth,
      enemiesRemaining: Math.max(0, state.enemiesRemaining - destroyed.length),
    },
    destroyed,
    impacts,
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
  barrelLength: number,
  pitch = 0
): { x: number; z: number } {
  const angle = heading + turret;
  const horizontal = Math.cos(pitch) * barrelLength;
  return {
    x: position.x + Math.cos(angle) * horizontal,
    z: position.z - Math.sin(angle) * horizontal,
  };
}

export function elevatedMuzzleHeight(
  barrelHeight: number,
  barrelLength: number,
  pitch: number
): number {
  return barrelHeight - Math.sin(pitch) * barrelLength;
}

/**
 * Loads shells over time so the gun keeps working without an answer, while a
 * correct answer still tops the magazine up instantly.
 */
export function advanceReload(
  state: CombatState,
  deltaSeconds: number
): CombatState {
  if (state.ammo >= MAX_AMMO) {
    return state.reloadMs === 0 ? state : { ...state, reloadMs: 0 };
  }
  const reloadMs = state.reloadMs + deltaSeconds * 1000;
  if (reloadMs < AUTO_RELOAD_MS) return { ...state, reloadMs };
  return {
    ...state,
    ammo: Math.min(MAX_AMMO, state.ammo + 1),
    reloadMs: reloadMs - AUTO_RELOAD_MS,
  };
}
