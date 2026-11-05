import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from 'three';
import { describe, expect, it } from 'vitest';

import {
  advanceShells,
  createCombatState,
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

    expect(hit?.enemy.id).toBe('near');
    expect(hit?.point.x).toBeCloseTo(9);
    expect(hit?.fraction).toBeCloseTo(9 / 25);
  });
});
