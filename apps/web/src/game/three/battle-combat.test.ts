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
  elevatedMuzzleHeight,
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

    const elevated = muzzlePoint({ x: 1, z: 2 }, 0, 0, 3, Math.PI / 3);
    expect(elevated.x).toBeCloseTo(2.5);
    expect(elevated.z).toBeCloseTo(2);

    const muzzleY = elevatedMuzzleHeight(1.57, 3, Math.PI / 3);
    expect(muzzleY).toBeCloseTo(1.57 - 3 * Math.sin(Math.PI / 3));
    const fired = spawnShell(
      createCombatState(2),
      elevated,
      0,
      Math.PI / 3,
      muzzleY
    );
    expect(fired.shells[0]?.y).toBeCloseTo(muzzleY);
    expect(fired.shells[0]?.pitch).toBeCloseTo(Math.PI / 3);
    const advanced = advanceShells(fired, 0.1, [], 42);
    expect(advanced.state.shells[0]?.y).toBeCloseTo(
      muzzleY - Math.sin(Math.PI / 3) * 4.2
    );
  });

  it('applies damage until the enemy is destroyed and decrements the count', () => {
    const enemies = [enemy('a', 10, 0), enemy('b', 30, 0)];
    let state = createCombatState(2, 1, 150, enemies);
    let destroyed: string[] = [];
    for (let shot = 0; shot < 3; shot += 1) {
      state = spawnShell(state, { x: 0, z: 0 }, 0);
      for (let step = 0; step < 20; step += 1) {
        const result = advanceShells(state, 0.1, enemies, 42);
        state = result.state;
        destroyed = [...destroyed, ...result.destroyed];
      }
    }
    expect(destroyed).toEqual(['a']);
    expect(state.enemyHealth.a).toBe(0);
    expect(state.enemiesRemaining).toBe(1);
  });

  it('blocks a shell that cannot penetrate and preserves enemy health', () => {
    const enemies = [enemy('a', 10, 0)];
    let state = createCombatState(1, 1, 150, enemies);
    state = spawnShell(state, { x: 0, z: 0 }, 0, 0, 1.2, 34, 0);
    const result = advanceShells(state, 0.5, enemies, 42);

    expect(result.destroyed).toEqual([]);
    expect(result.state.enemyHealth.a).toBe(100);
    expect(result.impacts[0]).toMatchObject({
      enemyId: 'a',
      damage: 0,
      zone: 'rear',
      outcome: 'blocked',
    });
  });

  it('sweeps a fast shell through a target instead of tunnelling', () => {
    const enemies = [enemy('a', 10, 0)];
    let state = createCombatState(1, 1, 150, enemies);
    state = spawnShell(state, { x: 0, z: 0 }, 0);

    const result = advanceShells(state, 0.5, enemies, 420);

    expect(result.state.enemyHealth.a).toBe(66);
    expect(result.destroyed).toEqual([]);
    expect(result.impacts[0]).toMatchObject({
      enemyId: 'a',
      damage: 34,
      zone: 'rear',
      outcome: 'penetrated',
    });
    expect(result.impacts[0]?.impactAngleDegrees).toBeTypeOf('number');
  });

  it('applies grazing-angle ricochets to both shell directions', () => {
    const enemies = [enemy('a', 10, 0)];
    const outgoing = advanceShells(
      spawnShell(
        createCombatState(1, 1, 150, enemies),
        { x: 0, z: 0 },
        Math.PI / 2,
        0,
        1.2,
        34,
        200
      ),
      0.5,
      enemies,
      42,
      (_from, _to, targets) => ({
        enemy: targets[0]!,
        fraction: 0.5,
        point: { x: 10, y: 1.2, z: 0 },
      })
    );
    expect(outgoing.state.enemyHealth.a).toBe(100);
    expect(outgoing.impacts[0]).toMatchObject({
      damage: 0,
      outcome: 'ricochet',
    });

    const incoming = advanceEnemyShells(
      spawnEnemyShell(createCombatState(1, 1, 200), {
        x: 0,
        z: 1.5,
        heading: 0.1,
        damage: 34,
        projectilePenetration: 200,
        projectileSpeed: 4,
        sourceId: 'scout',
      }),
      0.1,
      { x: 0, z: 0 },
      0,
      { front: 78, side: 58, rear: 42 },
      0
    );
    expect(incoming.state.playerHealth, JSON.stringify(incoming.impacts)).toBe(
      200
    );
    expect(incoming.impacts[0]).toMatchObject({
      damage: 0,
      outcome: 'ricochet',
    });
  });

  it('damages the ammo rack before causing an explosion on a critical hit', () => {
    const enemies = [enemy('a', 10, 0)];
    const first = advanceShells(
      spawnShell(createCombatState(1, 1, 150, enemies), { x: 0, z: 0 }, 0),
      0.5,
      enemies,
      420,
      undefined,
      () => 0
    );
    expect(first.state.enemyHealth.a).toBe(100);
    expect(first.impacts[0]).toMatchObject({
      damage: 0,
      outcome: 'critical',
      ammoRackRemaining: 13,
    });

    const second = advanceShells(
      spawnShell(first.state, { x: 0, z: 0 }, 0),
      0.5,
      enemies,
      420,
      undefined,
      () => 0
    );
    expect(second.state.enemyHealth.a).toBe(0);
    expect(second.state.enemiesRemaining).toBe(0);
    expect(second.destroyed).toEqual(['a']);
    expect(second.impacts[0]).toMatchObject({
      damage: 0,
      outcome: 'ammo-explosion',
      ammoRackRemaining: 0,
    });
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

  it('uses the firing tank projectile speed instead of the player speed', () => {
    const scout = enemy('a', 5, 0);
    scout.combat = {
      maxHealth: 100,
      armorReduction: 0,
      armorProfile: { front: 54, side: 40, rear: 30 },
      speed: 79,
      projectileDamage: 15,
      projectilePenetration: 40,
      projectileSpeed: 200,
      fireCooldownMs: 1900,
    };
    const fire = advanceEnemyFire(
      createCombatState(1),
      [scout],
      { x: 0, z: 0 },
      0.1
    );
    const state = spawnEnemyShell(fire.state, fire.launches[0]!);
    const advanced = advanceEnemyShells(state, 0.5, { x: 100, z: 0 });

    expect(fire.launches[0]?.projectileSpeed).toBe(200);
    expect(fire.launches[0]?.projectilePenetration).toBe(40);
    expect(advanced.state.enemyShells[0]?.x).toBeCloseTo(-5);
  });

  it('blocks scout shells on heavy front armour but applies rear damage', () => {
    const profile = { front: 102, side: 74, rear: 52 };
    const launch = {
      x: 8,
      z: 0,
      heading: Math.PI,
      damage: 27,
      projectilePenetration: 70,
      sourceId: 'scout',
    };
    const front = spawnEnemyShell(createCombatState(1, 1, 200), launch);
    const blocked = advanceEnemyShells(
      front,
      0.1,
      { x: 4, z: 0 },
      0.19,
      profile,
      0
    );
    expect(blocked.damage, JSON.stringify(blocked.impacts)).toBe(0);
    expect(blocked.state.playerHealth).toBe(200);

    const rear = advanceEnemyShells(
      spawnEnemyShell(createCombatState(1, 1, 200), {
        ...launch,
        x: -8,
        heading: 0,
      }),
      0.1,
      { x: -4, z: 0 },
      0.19,
      profile,
      0
    );
    expect(rear.damage).toBe(18);
    expect(rear.state.playerHealth).toBe(182);
  });

  it('applies critical hits and ammo-rack explosions to the player too', () => {
    const launch = {
      x: 8,
      z: 0,
      heading: Math.PI,
      damage: 34,
      projectilePenetration: 200,
      sourceId: 'scout',
    };
    let state = createCombatState(1, 1, 200);
    let result = advanceEnemyShells(
      spawnEnemyShell(state, launch),
      0.1,
      { x: 4, z: 0 },
      0,
      { front: 78, side: 58, rear: 42 },
      0,
      () => 0
    );
    state = result.state;
    expect(state.playerHealth).toBe(200);
    expect(result.impacts[0]).toMatchObject({
      damage: 0,
      outcome: 'critical',
      ammoRackRemaining: 48,
    });

    for (let hit = 0; hit < 3; hit += 1) {
      result = advanceEnemyShells(
        spawnEnemyShell(state, launch),
        0.1,
        { x: 4, z: 0 },
        0,
        { front: 78, side: 58, rear: 42 },
        0,
        () => 0
      );
      state = result.state;
    }
    expect(state.playerHealth).toBe(0);
    expect(state.playerDestroyed).toBe(true);
    expect(result.impacts[0]).toMatchObject({
      damage: 0,
      outcome: 'ammo-explosion',
      ammoRackRemaining: 0,
    });
  });

  it('keeps enemy shells at their authored muzzle height and pitch', () => {
    const state = spawnEnemyShell(createCombatState(1), {
      x: 0,
      y: 3,
      z: 0,
      heading: 0,
      pitch: Math.PI / 6,
      damage: 12,
      sourceId: 'a',
    });
    const advanced = advanceEnemyShells(state, 0.1, { x: 100, z: 0 });
    expect(advanced.state.enemyShells[0]?.y).toBeCloseTo(0.9);
    expect(advanced.state.enemyShells[0]?.x).toBeCloseTo(
      4.2 * Math.cos(Math.PI / 6)
    );
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
