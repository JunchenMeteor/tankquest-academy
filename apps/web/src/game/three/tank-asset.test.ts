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

  it('raises and sizes the front idler before normalisation', () => {
    const root = new Group();
    const idler = new Group();
    idler.name = 'Wheel_L_00';
    idler.position.set(0, 60, 240);
    root.add(idler);

    normalise(root);

    expect(idler.position.y).toBe(82);
    expect(idler.position.z).toBe(258);
    expect(idler.scale.x).toBeCloseTo(1.12);
    expect(idler.scale.y).toBeCloseTo(1.12);
    expect(idler.scale.z).toBeCloseTo(1.12);
  });

  it('preserves authored hull and turret regions during painting', () => {
    const root = new Group();
    const hull = new Group();
    hull.name = 'Hull';
    const hullEquipment = part('Gear_Hull', 1, 1);
    hull.add(hullEquipment);
    const turret = new Group();
    turret.name = 'TurretPivot';
    const gun = new Group();
    gun.name = 'GunPivot';
    gun.add(part('Barrel_Cannon_13', 2, 4));
    const muzzle = new Group();
    muzzle.name = 'Muzzle';
    gun.add(muzzle);
    const turretEquipment = part('Gear_Turret', -3, 1);
    turret.add(gun, part('Turret_229', 0, 2), turretEquipment);
    root.add(hull, turret);
    root.updateMatrixWorld(true);
    const hullBefore = hullEquipment.getWorldPosition(new Vector3());
    const turretBefore = turretEquipment.getWorldPosition(new Vector3());

    const painted = paintTankRig(tankRigFromScene(root), 0x6d8798, 0xe8c65a);
    const paintedHull = painted.root.getObjectByName('Gear_Hull')!;
    const paintedTurret = painted.root.getObjectByName('Gear_Turret')!;
    expect(paintedHull.parent?.name).toBe('Hull');
    expect(paintedTurret.parent?.name).toBe('TurretPivot');

    painted.turret.rotation.y = Math.PI / 2;
    painted.root.updateMatrixWorld(true);
    expect(
      paintedHull.getWorldPosition(new Vector3()).distanceTo(hullBefore)
    ).toBeCloseTo(0);
    const turretAfter = paintedTurret.getWorldPosition(new Vector3());
    expect(turretAfter.x).toBeCloseTo(turretBefore.z);
    expect(turretAfter.z).toBeCloseTo(-turretBefore.x);
  });

  it('paints armour side skirts with the primary colour and gear as accents', () => {
    const root = new Group();
    const hull = new Group();
    hull.name = 'Hull';
    const skirts = part('SideSkirts_477', 0, 4);
    (skirts.material as MeshStandardMaterial).name = 'SideSkirts_477';
    const equipment = part('Gear_Hull', 1, 1);
    (equipment.material as MeshStandardMaterial).name = 'Gear_980';
    hull.add(skirts, equipment);
    const turret = new Group();
    turret.name = 'TurretPivot';
    const gun = new Group();
    gun.name = 'GunPivot';
    const muzzle = new Group();
    muzzle.name = 'Muzzle';
    gun.add(muzzle);
    const antenna = part('Gear_24', 0, 1);
    (antenna.material as MeshStandardMaterial).name = 'Gear_24';
    turret.add(gun, antenna);
    root.add(hull, turret);

    const painted = paintTankRig(tankRigFromScene(root), 0x733f39, 0xd7aa57);
    const materialOf = (name: string) =>
      (painted.root.getObjectByName(name) as Mesh)
        .material as MeshStandardMaterial;
    expect(materialOf('SideSkirts_477').color.getHex()).toBe(0x733f39);
    expect(materialOf('Gear_Hull').color.getHex()).toBe(0xd7aa57);
    expect(materialOf('Gear_24').color.getHex()).toBe(0xd7aa57);
  });
});
