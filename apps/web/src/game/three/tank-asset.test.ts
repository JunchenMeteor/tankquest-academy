import {
  Box3,
  BoxGeometry,
  Color,
  Group,
  Mesh,
  MeshStandardMaterial,
  Texture,
  Vector3,
} from 'three';
import { describe, expect, it } from 'vitest';

import {
  normalise,
  paintTankRig,
  pruneRedundantCombinedTank,
} from './tank-asset.js';
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
  it('removes the combined scout mesh when articulated hull and wheels exist', () => {
    const root = new Group();
    root.add(
      part('Tank_body', 0, 6),
      part('Hull_477', 0, 6),
      part('Wheel_L_01', 0, 1)
    );

    pruneRedundantCombinedTank(root);

    expect(root.getObjectByName('Tank_body')).toBeUndefined();
    expect(root.getObjectByName('Hull_477')).toBeDefined();
    expect(root.getObjectByName('Wheel_L_01')).toBeDefined();
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

  it('centres the root on the hull rather than the gun barrel', () => {
    const root = new Group();
    const hull = new Group();
    hull.name = 'Hull';
    hull.add(part('Hull_477', 0, 4));
    const turret = new Group();
    turret.name = 'TurretPivot';
    const gun = new Group();
    gun.name = 'GunPivot';
    gun.add(part('Barrel_Cannon_13', -4, 6));
    turret.add(gun);
    root.add(hull, turret);

    normalise(root);
    root.updateMatrixWorld(true);

    const hullCentre = new Box3().setFromObject(hull).getCenter(new Vector3());
    expect(hullCentre.x).toBeCloseTo(0);
    expect(hullCentre.z).toBeCloseTo(0);
    expect(new Box3().setFromObject(root).min.y).toBeCloseTo(0);
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

  it('preserves authored wheel radii without applying legacy wheel adjustments', () => {
    const root = new Group();
    const wheel = part('Wheel_L_01', 0, 1);
    wheel.userData.rollingRadius = 2;
    root.add(wheel);

    normalise(root);

    expect(wheel.scale.toArray()).toEqual([1, 1, 1]);
    expect(wheel.userData.rollingRadius).toBeCloseTo(6);
    expect(root.getObjectByName('ReturnRoller_L_00')).toBeUndefined();
  });

  it('preserves every material slot on multi-material tank meshes', () => {
    const root = new Group();
    const hull = new Group();
    hull.name = 'Hull';
    const body = part('Hull_477', 0, 4);
    const primary = new MeshStandardMaterial();
    primary.name = 'Main';
    const accent = new MeshStandardMaterial();
    accent.name = 'Gear_980';
    body.material = [primary, accent];
    hull.add(body);
    const turret = new Group();
    turret.name = 'TurretPivot';
    const gun = new Group();
    gun.name = 'GunPivot';
    const muzzle = new Group();
    muzzle.name = 'Muzzle';
    gun.add(muzzle);
    turret.add(gun);
    root.add(hull, turret);

    const painted = paintTankRig(tankRigFromScene(root), 0x426b8a, 0xe8c65a);
    const materials = (painted.root.getObjectByName('Hull_477') as Mesh)
      .material as MeshStandardMaterial[];
    expect(materials).toHaveLength(2);
    expect(materials[0]?.color.getHex()).toBe(0x426b8a);
    expect(materials[1]?.color.getHex()).toBe(0xe8c65a);
  });
});

describe('authored PBR painting', () => {
  it('keeps textured armour readable instead of replacing its base colour', () => {
    const root = new Group();
    const turret = new Group();
    turret.name = 'TurretPivot';
    const gun = new Group();
    gun.name = 'GunPivot';
    const muzzle = new Group();
    muzzle.name = 'Muzzle';
    gun.add(muzzle);
    turret.add(gun);
    const material = new MeshStandardMaterial({
      color: 0x808080,
      map: new Texture(),
    });
    material.name = 'Main';
    const armour = part('Turret_229', 0, 2);
    armour.material = material;
    turret.add(armour);
    root.add(turret);

    const painted = paintTankRig(tankRigFromScene(root), 0x406080);
    const paintedMaterial = (painted.root.getObjectByName('Turret_229') as Mesh)
      .material as MeshStandardMaterial;
    const expected = new Color(0x808080).lerp(new Color(0x406080), 0.2);

    expect(paintedMaterial.color.toArray()).toEqual(expected.toArray());
    expect(paintedMaterial.map).not.toBe(material.map);
    expect(material.color.getHex()).toBe(0x808080);
  });
});
