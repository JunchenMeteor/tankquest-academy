import { BoxGeometry, Group, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';

import { bake, normalise, paintTank, paintTankRig } from './tank-asset.js';
import { tankRigFromScene } from './tank-rig.js';

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

  it('reports the muzzle in gun-local coordinates for an offset turret', () => {
    const scene = new Group();
    scene.add(
      part('Hull_477', 0, 6),
      part('Turret_229', 1, 2),
      part('Barrel_Cannon_13', 6, 10)
    );
    const asset = bake(scene);
    normalise(asset.root);

    const painted = paintTank(asset, 0xffffff);
    const gun = painted.turret.userData.gun as Group;
    const muzzle = gun.localToWorld(painted.muzzle!.clone());
    const barrelTip = new Vector3(0, 0, 11).applyMatrix4(
      painted.root.getObjectByName('model-normalised')!.matrixWorld
    );

    expect(gun).toBe(painted.root.getObjectByName('gun-pivot'));
    expect(gun.userData.pitchAxis).toBe('x');
    expect(asset.turret.position.z).toBeCloseTo(1);
    expect(muzzle.distanceTo(barrelTip)).toBeCloseTo(0);
  });

  it('normalises a +Z barrel to the +X battle forward axis', () => {
    const root = new Group();
    root.add(part('Barrel_Cannon_13', 3, 6));

    normalise(root);
    root.updateMatrixWorld(true);
    const forward = new Vector3(0, 0, 1).transformDirection(
      root.getObjectByName('model-normalised')!.matrixWorld
    );

    expect(forward.x).toBeCloseTo(1);
    expect(forward.z).toBeCloseTo(0);
    expect(root.rotation.y).toBe(0);
    expect(root.position.toArray()).toEqual([0, 0, 0]);
  });

  it('keeps rear equipment on the turret during traversal', () => {
    const root = new Group();
    const turret = new Group();
    turret.name = 'TurretPivot';
    const gun = new Group();
    gun.name = 'GunPivot';
    gun.add(part('Barrel_Cannon_13', 2, 4));
    const muzzle = new Group();
    muzzle.name = 'Muzzle';
    gun.add(muzzle);
    turret.add(gun, part('Turret_229', 0, 2));
    const equipment = part('Gear_980', -3, 1);
    root.add(turret, equipment);
    root.updateMatrixWorld(true);
    const before = equipment.getWorldPosition(new Vector3());

    const painted = paintTankRig(tankRigFromScene(root), 0x6d8798, 0xe8c65a);
    const attached = painted.root.getObjectByName('Gear_980')!;
    expect(attached.parent?.name).toBe('TurretPivot');
    expect(
      attached.getWorldPosition(new Vector3()).distanceTo(before)
    ).toBeCloseTo(0);

    painted.turret.rotation.y = Math.PI / 2;
    painted.root.updateMatrixWorld(true);
    const after = attached.getWorldPosition(new Vector3());
    expect(after.x).toBeCloseTo(before.z);
    expect(after.z).toBeCloseTo(-before.x);
  });
});
