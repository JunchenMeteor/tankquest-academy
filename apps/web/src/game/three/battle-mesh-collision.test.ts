import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from 'three';
import { describe, expect, it } from 'vitest';

import {
  advanceEnemyShells,
  advanceShells,
  createCombatState,
  spawnEnemyShell,
  spawnShell,
} from './battle-combat.js';
import { createMeshHitTest } from './battle-mesh-collision.js';
import type { TankPlacement } from './battle-scene-model.js';

function enemy(id: string, x: number): TankPlacement {
  return {
    id,
    role: 'scout',
    elite: false,
    position: { x, y: 0, z: 0 },
    heading: 0,
    hull: [2, 2, 2],
    turretRadius: 0.8,
    barrelLength: 2,
    color: 0x8f5745,
  };
}

function boxRoot(x: number): Group {
  const root = new Group();
  root.position.set(x, 1.2, 0);
  root.add(new Mesh(new BoxGeometry(2, 2, 2), new MeshStandardMaterial()));
  return root;
}

describe('mesh projectile collision', () => {
  it('hits the visible surface instead of an oversized centre sphere', () => {
    const target = enemy('a', 10);
    const hitTest = createMeshHitTest(new Map([['a', boxRoot(10)]]));
    let state = createCombatState(1, 1, 150, [target]);
    state = spawnShell(state, { x: 0, z: 0 }, 0);

    const result = advanceShells(state, 1, [target], 20, hitTest);

    expect(result.impacts).toHaveLength(1);
    expect(result.impacts[0]?.point.x).toBeCloseTo(9);
    expect(result.state.enemyHealth.a).toBe(66);
  });

  it('selects the nearest mesh and ignores enemies without a rendered root', () => {
    const near = enemy('near', 10);
    const far = enemy('far', 20);
    const missing = enemy('missing', 5);
    const hitTest = createMeshHitTest(
      new Map([
        ['near', boxRoot(10)],
        ['far', boxRoot(20)],
      ])
    );

    const hit = hitTest({ x: 0, y: 1.2, z: 0 }, { x: 25, y: 1.2, z: 0 }, [
      far,
      missing,
      near,
    ]);

    expect(hit?.enemy?.id).toBe('near');
    expect(hit?.point.x).toBeCloseTo(9);
    expect(hit?.fraction).toBeCloseTo(9 / 25);
  });

  it('stops player shells at cover before the enemy without dealing damage', () => {
    const target = enemy('a', 10);
    const hitTest = createMeshHitTest(new Map([['a', boxRoot(10)]]), [
      boxRoot(5),
    ]);
    let state = createCombatState(1, 1, 150, [target]);
    state = spawnShell(state, { x: 0, z: 0 }, 0);

    const result = advanceShells(state, 1, [target], 20, hitTest);

    expect(result.state.shells).toHaveLength(0);
    expect(result.impacts).toHaveLength(0);
    expect(result.state.enemyHealth.a).toBe(100);
  });

  it('stops enemy shells at cover before the player without dealing damage', () => {
    const hitTest = createMeshHitTest(new Map(), [boxRoot(5)]);
    const state = spawnEnemyShell(createCombatState(1, 1, 200), {
      x: 0,
      z: 0,
      heading: 0,
      damage: 34,
      projectilePenetration: 200,
      projectileSpeed: 80,
      sourceId: 'scout',
    });

    const result = advanceEnemyShells(
      state,
      1,
      { x: 10, z: 0 },
      0,
      undefined,
      0,
      () => 1,
      hitTest
    );

    expect(result.state.enemyShells).toHaveLength(0);
    expect(result.impacts).toHaveLength(0);
    expect(result.state.playerHealth).toBe(200);
  });

  it('stops a downward shell at the terrain surface', () => {
    const terrain = new Group();
    terrain.add(new Mesh(new BoxGeometry(100, 0.1, 100), undefined));
    const hitTest = createMeshHitTest(new Map(), [terrain]);
    let state = createCombatState(1);
    state = spawnShell(state, { x: 0, z: 0 }, 0, 0.2, 1.2);

    const result = advanceShells(state, 1, [], 20, hitTest);

    expect(result.state.shells).toHaveLength(0);
    expect(result.impacts).toHaveLength(0);
  });
});
