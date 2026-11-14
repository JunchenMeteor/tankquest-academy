import { Group, PerspectiveCamera } from 'three';
import { describe, expect, it } from 'vitest';

import { createPlayerAimController } from './player-aim-controller.js';
import type { TankRig } from './tank-rig.js';

function rigWithOffset(): TankRig {
  const root = new Group();
  const turret = new Group();
  const gun = new Group();
  const muzzle = new Group();
  root.rotation.z = 0.1;
  gun.rotation.y = Math.PI / 2;
  muzzle.rotation.y = 0.01;
  muzzle.position.z = 4;
  root.add(turret);
  turret.add(gun);
  gun.add(muzzle);
  root.updateMatrixWorld(true);
  return {
    root,
    turret,
    gun,
    muzzle,
    wheels: [],
    idlers: [],
    sprockets: [],
    returnRollers: [],
    wheelAxis: 'x',
    wheelRadius: 0.38,
    trackTextures: [],
    trackLoops: [],
  };
}

describe('player aim controller', () => {
  it('converges the real muzzle axis and projects both reticles', () => {
    const rig = rigWithOffset();
    const camera = new PerspectiveCamera(60, 1, 0.1, 200);
    camera.position.set(0, 0, 10);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld(true);
    const controller = createPlayerAimController({
      getRig: () => rig,
      traverseSpeed: 10,
      elevationSpeed: 10,
    });
    const state = { position: { x: 0, y: 0, z: 0 }, heading: 0, turret: 0 };
    for (let frame = 0; frame < 10; frame += 1) {
      const control = controller.updateControl({
        delta: 1,
        state,
        command: { forward: 0, turn: 0, turret: 0 },
        rightHeld: false,
        pointer: { x: 50, y: 50, ready: true },
        camera,
        camYaw: 0,
        bounds: { width: 100, height: 100 },
        targets: [],
      });
      state.turret = control.turret;
      rig.turret.rotation.y = control.turret;
      rig.gun.rotation.x = control.gunPitch;
      rig.root.updateMatrixWorld(true);
    }
    const result = controller.updatePresentation({
      camera,
      pointer: { x: 50, y: 50, ready: true },
      guidedAim: true,
      bounds: { width: 100, height: 100 },
    });
    expect(result.aligned).toBe(true);
    expect(result.sight.x).toBeCloseTo(50);
    expect(result.sight.y).toBeCloseTo(50);
    expect(result.direction.length()).toBeCloseTo(1);
  });

  it('keeps the camera target on the non-guided path', () => {
    const controller = createPlayerAimController({
      getRig: rigWithOffset,
      traverseSpeed: 0.5,
      elevationSpeed: 1,
    });
    const result = controller.updateControl({
      delta: 0.2,
      state: { position: { x: 0, y: 0, z: 0 }, heading: 0, turret: 0 },
      command: { forward: 0, turn: 0, turret: 0 },
      rightHeld: true,
      pointer: { x: 50, y: 50, ready: false },
      camera: new PerspectiveCamera(),
      camYaw: 1,
      bounds: { width: 100, height: 100 },
      targets: [],
    });
    expect(result.turret).toBe(0);
    expect(result.guidedAim).toBe(false);
    expect(result.aimOffset).toBeNull();
  });
});
