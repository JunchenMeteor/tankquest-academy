import { BoxGeometry, Group, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';

import { bake, normalise, paintTank } from './tank-asset.js';

function part(name: string, z: number, length: number): Mesh {
  const mesh = new Mesh(
    new BoxGeometry(2, 1, length),
    new MeshStandardMaterial()
  );
  mesh.name = name;
  mesh.position.z = z;
  return mesh;
}

describe('imported tank asset', () => {
  it('centres the turret on its drum and preserves part names', () => {
    const scene = new Group();
    scene.add(
      part('Hull_477', 0, 6),
      part('Turret_229', 0, 2),
      part('Barrel_Cannon_13', 6, 10)
    );

    const asset = bake(scene);

    expect(asset.turret.position.x).toBeCloseTo(0);
    expect(asset.turret.position.z).toBeCloseTo(0);
    expect(asset.turret.children.map((child) => child.name)).toEqual([
      'Turret_229',
      'gun-pivot',
    ]);
    expect(asset.turret.userData.gun).toBe(
      asset.root.getObjectByName('gun-pivot')
    );
    expect(asset.root.getObjectByName('gun-pivot')?.children[0]?.name).toBe(
      'Barrel_Cannon_13'
    );
    expect(asset.root.getObjectByName('hull')?.children).toHaveLength(1);
  });

  it('keeps gun controls and reports normalised barrel dimensions', () => {
    const scene = new Group();
    scene.add(
      part('Hull_477', 0, 6),
      part('Turret_229', 0, 2),
      part('Barrel_Cannon_13', 6, 10)
    );
    const asset = bake(scene);
    normalise(asset.root);

    const painted = paintTank(asset, 0xffffff);

    expect(painted.turret.userData.gun).toBe(
      painted.root.getObjectByName('gun-pivot')
    );
    expect(painted.barrelLength).toBeGreaterThan(0);
    expect(Number.isFinite(painted.barrelHeight)).toBe(true);
  });

  it('normalises a +Z barrel to the +X battle forward axis', () => {
    const root = new Group();
    root.add(part('Barrel_Cannon_13', 3, 6));

    normalise(root);
    root.updateMatrixWorld(true);
    const forward = new Vector3(0, 0, 1).transformDirection(root.matrixWorld);

    expect(forward.x).toBeCloseTo(1);
    expect(forward.z).toBeCloseTo(0);
  });
});
