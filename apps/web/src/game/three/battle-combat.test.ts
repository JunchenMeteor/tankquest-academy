import { describe, expect, it } from 'vitest';

import {
  MAX_AMMO,
  advanceShells,
  applyWrongAnswer,
  canFire,
  createCombatState,
  loadAmmo,
  muzzlePoint,
  spawnShell,
  tickCooldown,
} from './battle-combat.js';
import type { TankPlacement } from './battle-scene-model.js';

function enemy(id: string, x: number, z: number): TankPlacement {
  return {
    id,
    role: 'scout',
    elite: false,
    position: { x, y: 0, z },
    heading: 0,
    hull: [3, 0.85, 1.8],
    turretRadius: 0.8,
    barrelLength: 2,
    color: 0x8f5745,
  };
}

describe('3D battle combat', () => {
  it('counts shots and enforces the reload timer', () => {
    const base = createCombatState(2);
    const fired = spawnShell(base, { x: 0, z: 0 }, 0);
    expect(fired.shotsFired).toBe(1);
    expect(fired.cooldownMs).toBeGreaterThan(0);

    const halfTick = tickCooldown(fired, 0.45);
    expect(halfTick.cooldownMs).toBeGreaterThan(0);
    const done = tickCooldown(halfTick, 0.6);
    expect(done.cooldownMs).toBe(0);
  });

  it('loads rewarded ammo up to the magazine cap', () => {
    const base = createCombatState(1, 0);
    expect(loadAmmo(base, 2).ammo).toBe(2);
    expect(loadAmmo(loadAmmo(base, 4), 4).ammo).toBe(MAX_AMMO);
    expect(loadAmmo(base, 0)).toBe(base);
  });

  it('blocks firing without ammo and spends a round when firing', () => {
    const empty = createCombatState(1, 0);
    expect(canFire(empty)).toBe(false);
    const loaded = createCombatState(1, 1);
    expect(canFire(loaded)).toBe(true);
    const fired = spawnShell(loaded, { x: 0, z: 0 }, 0);
    expect(fired.ammo).toBe(0);
    expect(canFire(fired)).toBe(false);
  });

  it('adds a reload penalty for a wrong answer', () => {
    const punished = applyWrongAnswer(createCombatState(1, 1));
    expect(punished.cooldownMs).toBeGreaterThan(0);
    expect(canFire(punished)).toBe(false);
  });

  it('spawns the shell at the muzzle along the aiming angle', () => {
    const point = muzzlePoint({ x: 1, z: 2 }, 0, 0, 3);
    expect(point.x).toBeCloseTo(4);
    expect(point.z).toBeCloseTo(2);
  });

  it('destroys the enemy the shell reaches and decrements the count', () => {
    const enemies = [enemy('a', 10, 0), enemy('b', 30, 0)];
    let state = spawnShell(createCombatState(2), { x: 0, z: 0 }, 0);
    let destroyed: string[] = [];
    for (let step = 0; step < 20; step += 1) {
      const result = advanceShells(state, 0.1, enemies, 42);
      state = result.state;
      destroyed = [...destroyed, ...result.destroyed];
    }
    expect(destroyed).toEqual(['a']);
    expect(state.enemiesRemaining).toBe(1);
  });

  it('drops shells that fly past their range', () => {
    let state = spawnShell(createCombatState(1), { x: 0, z: 0 }, 0);
    for (let step = 0; step < 20; step += 1) {
      state = advanceShells(state, 0.5, [], 42).state;
    }
    expect(state.shells).toHaveLength(0);
    expect(state.enemiesRemaining).toBe(1);
  });
});
