import {
  Group,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Texture,
  Vector3,
} from 'three';
import { describe, expect, it } from 'vitest';

import { buildTankModel } from './tank-model.js';
import { advanceRunningGear, tankRigFromScene } from './tank-rig.js';

describe('TankRig contract', () => {
  it('uses explicit articulation nodes instead of inferred bounds', () => {
    const root = new Group();
    const turret = new Group();
    turret.name = 'TurretPivot';
    const gun = new Group();
    gun.name = 'GunPivot';
    const muzzle = new Object3D();
    muzzle.name = 'Muzzle';
    const wheel = new Group();
    wheel.name = 'Wheel_L_00';
    const track = new Mesh(
      undefined,
      new MeshStandardMaterial({ map: new Texture() })
    );
    track.name = 'Tracks_420';
    root.add(turret, wheel, track);
    turret.add(gun);
    gun.add(muzzle);

    const rig = tankRigFromScene(root);

    expect(rig.root).toBe(root);
    expect(rig.turret).toBe(turret);
    expect(rig.gun).toBe(gun);
    expect(rig.muzzle).toBe(muzzle);
    expect(rig.wheels).toEqual([]);
    expect(rig.idlers).toEqual([wheel]);
    expect(rig.sprockets).toEqual([]);
    expect(rig.wheelAxis).toBe('x');
    expect(rig.trackTextures).toHaveLength(1);
  });

  it('drives wheels and track textures in both travel directions', () => {
    const wheel = new Object3D();
    const texture = new Texture();
    const rig = {
      root: new Group(),
      turret: new Object3D(),
      gun: new Object3D(),
      muzzle: new Object3D(),
      wheels: [wheel],
      idlers: [],
      sprockets: [],
      wheelAxis: 'x' as const,
      wheelRadius: 0.3,
      trackTextures: [texture],
    };

    advanceRunningGear(rig, 1.5);
    expect(wheel.rotation.x).toBeCloseTo(-1.5 / (0.3 * 0.85));
    expect(texture.offset.y).toBeCloseTo(-0.375);

    advanceRunningGear(rig, -0.5);
    expect(wheel.rotation.x).toBeCloseTo(-1 / (0.3 * 0.85));
    expect(texture.offset.y).toBeCloseTo(-0.25);
  });

  it('rotates idlers and sprockets with their own radii', () => {
    const idler = new Object3D();
    const sprocket = new Object3D();
    const rig = {
      root: new Group(),
      turret: new Object3D(),
      gun: new Object3D(),
      muzzle: new Object3D(),
      wheels: [],
      idlers: [idler],
      sprockets: [sprocket],
      wheelAxis: 'x' as const,
      wheelRadius: 0.3,
      trackTextures: [],
    };
    advanceRunningGear(rig, 1);
    expect(idler.rotation.x).toBeCloseTo(-1 / (0.3 * 0.82));
    expect(sprocket.rotation.x).toBeCloseTo(-1 / (0.3 * 0.92));
  });

  it('reads the muzzle from its articulated world transform', () => {
    const root = new Group();
    const turret = new Group();
    turret.name = 'TurretPivot';
    const gun = new Group();
    gun.name = 'GunPivot';
    const muzzle = new Object3D();
    muzzle.name = 'Muzzle';
    muzzle.position.set(0, 0, 4);
    root.add(turret);
    turret.add(gun);
    gun.add(muzzle);
    root.position.set(3, 0, 2);
    root.rotation.y = Math.PI / 2;

    const rig = tankRigFromScene(root);

    const world = rig.muzzle.getWorldPosition(new Vector3());
    expect(world.x).toBeCloseTo(7);
    expect(world.y).toBeCloseTo(0);
    expect(world.z).toBeCloseTo(2);
  });
});

describe('procedural TankRig', () => {
  it('shares the same muzzle and running-gear contract', () => {
    const rig = buildTankModel(
      {
        id: 'player',
        role: 'medium',
        elite: false,
        position: { x: 0, y: 0, z: 0 },
        heading: 0,
        hull: [3.4, 1, 2],
        turretRadius: 0.95,
        barrelLength: 2.4,
        color: 0x6d8798,
      },
      true
    );

    expect(rig.muzzle.parent).toBe(rig.gun);
    expect(rig.wheels.length).toBeGreaterThan(0);
    expect(rig.muzzle.getWorldPosition(new Vector3()).x).toBeGreaterThan(3);
    const roadWheel = rig.wheels[0]!;
    const idler = rig.idlers[0]!;
    expect(
      roadWheel.position.y - rig.wheelRadius * roadWheel.scale.y
    ).toBeCloseTo(0.04);
    expect(
      idler.position.y - rig.wheelRadius * 0.92 * idler.scale.y
    ).toBeCloseTo(0.04);

    advanceRunningGear(rig, 0.6);
    expect(roadWheel.rotation.z).toBeCloseTo(-0.6 / (0.3 * 0.85));
  });
});
