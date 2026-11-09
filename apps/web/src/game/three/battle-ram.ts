import { healthAfterDamage } from '../systems/combat-damage.js';
import {
  calculateRamDamage,
  isRamDamageReady,
  type RamBodyState,
} from '../systems/ram-collision.js';
import type { CombatState } from './battle-combat.js';

export interface RamBody3D {
  id: string;
  mass: number;
  armorReduction: number;
  radius: number;
  previous: { x: number; z: number };
  current: { x: number; z: number };
}

export interface RamImpact3D {
  pairKey: string;
  firstId: string;
  secondId: string;
  damageToFirst: number;
  damageToSecond: number;
  relativeSpeed: number;
}

const RAM_SPEED_SCALE = 170 / 6;

function bodyState(body: RamBody3D, deltaSeconds: number): RamBodyState {
  return {
    armorReduction: body.armorReduction,
    mass: body.mass,
    velocityX:
      ((body.current.x - body.previous.x) / deltaSeconds) * RAM_SPEED_SCALE,
    velocityY:
      ((body.current.z - body.previous.z) / deltaSeconds) * RAM_SPEED_SCALE,
    x: body.current.x * RAM_SPEED_SCALE,
    y: body.current.z * RAM_SPEED_SCALE,
  };
}

export function calculateRamImpacts(
  bodies: RamBody3D[],
  deltaSeconds: number,
  cooldowns: ReadonlyMap<string, number>,
  nowMs: number
): RamImpact3D[] {
  if (deltaSeconds <= 0) return [];
  const impacts: RamImpact3D[] = [];
  for (let a = 0; a < bodies.length; a += 1) {
    for (let b = a + 1; b < bodies.length; b += 1) {
      const first = bodies[a]!;
      const second = bodies[b]!;
      if (first.id !== 'player' && second.id !== 'player') continue;
      const distance = Math.hypot(
        second.current.x - first.current.x,
        second.current.z - first.current.z
      );
      if (distance <= 0.0001 || distance >= first.radius + second.radius) {
        continue;
      }
      const pairKey = `${first.id}:${second.id}`;
      if (!isRamDamageReady(cooldowns.get(pairKey), nowMs)) continue;
      const damage = calculateRamDamage(
        bodyState(first, deltaSeconds),
        bodyState(second, deltaSeconds)
      );
      if (damage.damageToFirst === 0 && damage.damageToSecond === 0) continue;
      impacts.push({
        pairKey,
        firstId: first.id,
        secondId: second.id,
        damageToFirst: damage.damageToFirst,
        damageToSecond: damage.damageToSecond,
        relativeSpeed: damage.relativeSpeed,
      });
    }
  }
  return impacts;
}

export function applyRamImpacts(
  state: CombatState,
  impacts: RamImpact3D[]
): { state: CombatState; destroyed: string[] } {
  if (state.playerDestroyed || impacts.length === 0) {
    return { state, destroyed: [] };
  }
  const enemyHealth = { ...state.enemyHealth };
  let playerHealth = state.playerHealth;
  const destroyed = new Set<string>();
  let applied = false;

  for (const impact of impacts) {
    const playerFirst = impact.firstId === 'player';
    const enemyId = playerFirst ? impact.secondId : impact.firstId;
    if ((enemyHealth[enemyId] ?? 0) <= 0) continue;
    playerHealth = healthAfterDamage(
      playerHealth,
      playerFirst ? impact.damageToFirst : impact.damageToSecond
    );
    const enemyDamage = playerFirst
      ? impact.damageToSecond
      : impact.damageToFirst;
    const nextHealth = healthAfterDamage(enemyHealth[enemyId]!, enemyDamage);
    enemyHealth[enemyId] = nextHealth;
    if (nextHealth === 0) destroyed.add(enemyId);
    applied = true;
  }

  if (!applied) return { state, destroyed: [] };
  return {
    state: {
      ...state,
      playerHealth,
      playerDestroyed: playerHealth === 0,
      enemyHealth,
      enemiesRemaining: Math.max(0, state.enemiesRemaining - destroyed.size),
    },
    destroyed: [...destroyed],
  };
}
