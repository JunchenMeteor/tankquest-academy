import { describe, expect, it } from 'vitest';

import {
  ENEMY_FIRE_INTERVAL_MS,
  MAX_AMMO,
  advanceEnemyFire,
  advanceEnemyShells,
  advanceShells,
  applyWrongAnswer,
  canFire,
  createCombatState,
  loadAmmo,
  muzzlePoint,
  spawnEnemyShell,
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

describe('enemy fire', () => {
  it('opens fire only when the player is in range and the reload is ready', () => {
    const near = enemy('a', 5, 0);
    const far = enemy('b', 60, 0);
    const first = advanceEnemyFire(
      createCombatState(2),
      [near, far],
      { x: 0, z: 0 },
      0.1
    );
    expect(first.launches).toHaveLength(1);
    expect(first.launches[0]?.sourceId).toBe('a');

    const again = advanceEnemyFire(first.state, [near], { x: 0, z: 0 }, 0.1);
    expect(again.launches).toHaveLength(0);

    const later = advanceEnemyFire(
      again.state,
      [near],
      { x: 0, z: 0 },
      ENEMY_FIRE_INTERVAL_MS / 1000
    );
    expect(later.launches).toHaveLength(1);
  });

  it('damages the player when an incoming shell reaches them', () => {
    const state = spawnEnemyShell(createCombatState(1, 1, 100), {
      x: 0,
      z: 0,
      heading: 0,
      damage: 12,
      sourceId: 'a',
    });
    let next = state;
    let damage = 0;
    const player = { x: 6, z: 0 };
    for (let step = 0; step < 10; step += 1) {
      const result = advanceEnemyShells(next, 0.02, player);
      next = result.state;
      damage += result.damage;
    }
    expect(damage).toBe(12);
    expect(next.playerHealth).toBe(88);
    expect(next.playerDestroyed).toBe(false);
  });

  it('marks the player destroyed once health reaches zero', () => {
    const state = spawnEnemyShell(createCombatState(1, 1, 10), {
      x: 0,
      z: 0,
      heading: 0,
      damage: 12,
      sourceId: 'a',
    });
    let next = state;
    for (let step = 0; step < 10; step += 1) {
      next = advanceEnemyShells(next, 0.02, { x: 6, z: 0 }).state;
    }
    expect(next.playerHealth).toBe(0);
    expect(next.playerDestroyed).toBe(true);
  });
});

describe('enemy fire over time', () => {
  it('keeps firing and damaging a stationary player across several intervals', () => {
    const target = enemy('a', 8, 0);
    let state = createCombatState(1, 1, 150);
    const player = { x: 0, z: 0 };
    let totalDamage = 0;
    const dt = 0.05;
    for (let tick = 0; tick < 200; tick += 1) {
      const fire = advanceEnemyFire(state, [target], player, dt);
      state = fire.state;
      for (const launch of fire.launches)
        state = spawnEnemyShell(state, launch);
      const incoming = advanceEnemyShells(state, dt, player);
      state = incoming.state;
      totalDamage += incoming.damage;
    }
    expect(totalDamage).toBeGreaterThan(15);
    expect(state.playerHealth).toBeLessThan(150 - 15);
  });
});
