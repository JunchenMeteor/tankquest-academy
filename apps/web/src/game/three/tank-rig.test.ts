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
import {
  advanceRunningGear,
  applyGunRecoil,
  tankRigFromScene,
} from './tank-rig.js';

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
      returnRollers: [],
      wheelAxis: 'x' as const,
      wheelRadius: 0.3,
      trackTextures: [texture],
      trackLoops: [],
    };

    advanceRunningGear(rig, 1.5);
    expect(wheel.rotation.x).toBeCloseTo(-1.5 / (0.3 * 0.85));
    expect(texture.offset.y).toBeCloseTo(-0.375);

    advanceRunningGear(rig, -0.5);
    expect(wheel.rotation.x).toBeCloseTo(-1 / (0.3 * 0.85));
    expect(texture.offset.y).toBeCloseTo(-0.25);
  });

  it('rotates idlers and sprockets with their measured radii', () => {
    const idler = new Object3D();
    idler.userData.rollingRadius = 0.21;
    const sprocket = new Object3D();
    sprocket.userData.rollingRadius = 0.33;
    const rig = {
      root: new Group(),
      turret: new Object3D(),
      gun: new Object3D(),
      muzzle: new Object3D(),
      wheels: [],
      idlers: [idler],
      sprockets: [sprocket],
      returnRollers: [],
      wheelAxis: 'x' as const,
      wheelRadius: 0.3,
      trackTextures: [],
      trackLoops: [],
    };
    advanceRunningGear(rig, 1);
    expect(idler.rotation.x).toBeCloseTo(-1 / 0.21);
    expect(sprocket.rotation.x).toBeCloseTo(-1 / 0.33);
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
    expect(idler.position.x).toBeGreaterThan(0);
    expect(rig.sprockets[0]!.position.x).toBeLessThan(0);
    expect(roadWheel.position.y - roadWheel.userData.rollingRadius).toBeCloseTo(
      0.0493
    );
    expect(idler.position.y - idler.userData.rollingRadius).toBeCloseTo(0.0493);
    expect(rig.trackLoops).toHaveLength(2);
    const loop = rig.trackLoops[0]!;
    const initialLinkX = loop.links[0]!.position.x;

    advanceRunningGear(rig, 0.6);
    expect(roadWheel.rotation.z).toBeCloseTo(
      -0.6 / roadWheel.userData.rollingRadius
    );
    expect(loop.travelled).toBeCloseTo(0.6);
    expect(loop.links[0]!.position.x).not.toBeCloseTo(initialLinkX);

    advanceRunningGear(rig, -0.6);
    expect(loop.travelled).toBeCloseTo(0);
    expect(loop.links[0]!.position.x).toBeCloseTo(initialLinkX);
  });
});

describe('tank presentation attachments', () => {
  it('does not scroll textures on hull equipment that shares the track material', () => {
    const root = new Group();
    const texture = new Texture();
    const material = new MeshStandardMaterial({ map: texture });
    const track = new Mesh(undefined, material);
    track.name = 'Tracks_420_L';
    const equipment = new Mesh(undefined, material);
    equipment.name = 'Gear_Hull_TrackMaterial';
    root.add(track, equipment);
    const turret = new Group();
    turret.name = 'TurretPivot';
    const gun = new Group();
    gun.name = 'GunPivot';
    const muzzle = new Group();
    muzzle.name = 'Muzzle';
    gun.add(muzzle);
    turret.add(gun);
    root.add(turret);

    const rig = tankRigFromScene(root);
    advanceRunningGear(rig, 2);

    expect(rig.trackTextures).toEqual([texture]);
    expect(texture.offset.y).toBeCloseTo(-0.5);
    expect(equipment.rotation.x).toBe(0);
  });

  it('recoils a +Z imported gun without moving it sideways', () => {
    const gun = new Object3D();
    const muzzle = new Object3D();
    muzzle.position.z = 4;
    gun.add(muzzle);
    const rig = { gun, muzzle } as ReturnType<typeof tankRigFromScene>;
    const rest = new Vector3(1, 2, 3);

    applyGunRecoil(rig, rest, 0.12);
    expect(gun.position.toArray()).toEqual([1, 2, 2.88]);
    applyGunRecoil(rig, rest, 0);
    expect(gun.position.toArray()).toEqual([1, 2, 3]);
  });

  it('recoils a +X procedural gun along its own barrel', () => {
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
    const rest = rig.gun.position.clone();

    applyGunRecoil(rig, rest, 0.12);
    expect(rig.gun.position.x).toBeCloseTo(rest.x - 0.12);
    expect(rig.gun.position.y).toBeCloseTo(rest.y);
    expect(rig.gun.position.z).toBeCloseTo(rest.z);
  });
});
