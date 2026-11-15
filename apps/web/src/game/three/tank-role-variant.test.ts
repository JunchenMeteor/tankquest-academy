import { Box3, BoxGeometry, Group, Mesh, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';

import { paintTankRig } from './tank-asset.js';
import { tankRigFromScene, type TankRig } from './tank-rig.js';

function fixture(): TankRig {
  const root = new Group();
  const hull = new Group();
  hull.name = 'Hull';
  const body = new Mesh(new BoxGeometry(6, 1, 2));
  body.name = 'Hull_477';
  hull.add(body);
  const turret = new Group();
  turret.name = 'TurretPivot';
  turret.position.y = 1.2;
  const gun = new Group();
  gun.name = 'GunPivot';
  const muzzle = new Group();
  muzzle.name = 'Muzzle';
  muzzle.position.x = 2.5;
  gun.add(muzzle);
  turret.add(gun);
  root.add(hull, turret);
  return tankRigFromScene(root);
}

function size(rig: TankRig): Vector3 {
  rig.root.updateMatrixWorld(true);
  return new Box3().setFromObject(rig.root).getSize(new Vector3());
}

describe('tank role variants', () => {
  it('gives scouts, mediums, and heavies progressively larger silhouettes', () => {
    const asset = fixture();
    const scout = size(paintTankRig(asset, 0x556644, 0x222222, 'scout'));
    const medium = size(paintTankRig(asset, 0x556644, 0x222222, 'medium'));
    const heavy = size(paintTankRig(asset, 0x556644, 0x222222, 'heavy'));

    expect(scout.x).toBeLessThan(medium.x);
    expect(medium.x).toBeLessThan(heavy.x);
    expect(scout.z).toBeLessThan(medium.z);
    expect(medium.z).toBeLessThan(heavy.z);
  });

  it('keeps heavy turret armour on the turret and hull armour on the hull', () => {
    const rig = paintTankRig(fixture(), 0x556644, 0x222222, 'heavy');
    const hullPlate = rig.root.getObjectByName('HeavyHullPlate_L')!;
    const turretCheek = rig.root.getObjectByName('HeavyTurretCheek_L')!;
    rig.root.updateMatrixWorld(true);
    const hullBefore = hullPlate.getWorldPosition(new Vector3());
    const turretBefore = turretCheek.getWorldPosition(new Vector3());

    rig.turret.rotation.y = Math.PI / 2;
    rig.root.updateMatrixWorld(true);

    expect(
      hullPlate.getWorldPosition(new Vector3()).distanceTo(hullBefore)
    ).toBeCloseTo(0);
    expect(
      turretCheek.getWorldPosition(new Vector3()).distanceTo(turretBefore)
    ).toBeGreaterThan(0.5);
    expect(rig.muzzle.parent).toBe(rig.gun);
    expect(rig.root.userData.tankRole).toBe('heavy');
  });
});
