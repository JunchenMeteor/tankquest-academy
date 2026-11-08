import { PerspectiveCamera, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';

import {
  MAX_GUN_PITCH,
  aimAlignmentError,
  aimPitch,
  aimYaw,
  clampGunPitch,
  dispersionOffset,
  projectGunSight,
  rotateTowards,
  scatterAimPoint,
  stepGunPitch,
} from './battle-aim.js';

describe('3D battle aiming', () => {
  it('projects the sight through the actual muzzle axis', () => {
    const camera = new PerspectiveCamera(90, 1, 0.1, 100);
    camera.updateMatrixWorld();
    const muzzle = new Vector3(0, 0, -5);

    const forward = projectGunSight(muzzle, new Vector3(0, 0, -1), 5, camera);
    const sideways = projectGunSight(muzzle, new Vector3(1, 0, 0), 1, camera);

    expect(forward.x).toBeCloseTo(0);
    expect(forward.y).toBeCloseTo(0);
    expect(sideways.x).toBeCloseTo(0.2);
    expect(sideways.y).toBeCloseTo(0);
  });

  it('points at a target with the same convention as the hull heading', () => {
    expect(aimYaw({ x: 0, z: 0 }, { x: 10, z: 0 })).toBeCloseTo(0);
    expect(aimYaw({ x: 0, z: 0 }, { x: 0, z: 10 })).toBeCloseTo(-Math.PI / 2);
  });

  it('uses the same positive-down pitch convention as shell travel', () => {
    const from = { x: 0, y: 2, z: 0 };
    expect(aimPitch(from, { x: 10, y: 2, z: 0 })).toBeCloseTo(0);
    expect(aimPitch(from, { x: 10, y: 12, z: 0 })).toBeCloseTo(-Math.PI / 4);
    expect(aimPitch(from, { x: 10, y: -8, z: 0 })).toBeCloseTo(Math.PI / 4);
  });

  it('measures the angle between the real gun axis and its target', () => {
    const origin = { x: 0, y: 0, z: 0 };
    expect(
      aimAlignmentError(origin, { x: 1, y: 0, z: 0 }, { x: 10, y: 0, z: 0 })
    ).toBeCloseTo(0);
    expect(
      aimAlignmentError(origin, { x: 1, y: 0, z: 0 }, { x: 0, y: 0, z: 10 })
    ).toBeCloseTo(Math.PI / 2);
    expect(
      aimAlignmentError(origin, { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 })
    ).toBe(Math.PI);
  });

  it('limits gun elevation to twenty-five degrees in either direction', () => {
    expect(MAX_GUN_PITCH).toBeCloseTo(Math.PI / 7.2);
    expect(clampGunPitch(1)).toBeCloseTo(MAX_GUN_PITCH);
    expect(clampGunPitch(-1)).toBeCloseTo(-MAX_GUN_PITCH);
    expect(clampGunPitch(0.1)).toBeCloseTo(0.1);
  });

  it('turns toward the target no faster than the traverse speed', () => {
    const slow = rotateTowards(0, Math.PI / 2, 0.1);
    expect(slow).toBeCloseTo(0.1);

    const settled = rotateTowards(0, Math.PI / 2, 10);
    expect(settled).toBeCloseTo(Math.PI / 2);
  });

  it('takes the short way around the circle', () => {
    // From 3 rad the target at -3 rad is only 0.283 rad away across the seam.
    const result = rotateTowards(3, -3, 0.1);
    expect(result).toBeCloseTo(3.1, 5);
    expect(rotateTowards(3, -3, 0.5)).toBeCloseTo(-3, 5);
  });

  it('approaches and holds the pitch limit without chatter', () => {
    let pitch = 0;
    for (let frame = 0; frame < 100; frame += 1) {
      pitch = stepGunPitch(pitch, Math.PI, 0.02);
      expect(pitch).toBeLessThanOrEqual(MAX_GUN_PITCH);
    }
    expect(pitch).toBeCloseTo(MAX_GUN_PITCH);
    expect(stepGunPitch(pitch, Math.PI, 0.02)).toBe(MAX_GUN_PITCH);

    for (let frame = 0; frame < 100; frame += 1) {
      pitch = stepGunPitch(pitch, -Math.PI, 0.02);
      expect(pitch).toBeGreaterThanOrEqual(-MAX_GUN_PITCH);
    }
    expect(pitch).toBeCloseTo(-MAX_GUN_PITCH);
    expect(stepGunPitch(pitch, -Math.PI, 0.02)).toBe(-MAX_GUN_PITCH);
  });

  it('uses the tank traverse step for elevation instead of snapping', () => {
    expect(stepGunPitch(0, Math.PI, 0.01)).toBeCloseTo(0.01);
    expect(stepGunPitch(0, Math.PI, 0.04)).toBeCloseTo(0.04);
  });

  it('scatters inside the dispersion circle and never outside it', () => {
    const values = [0.25, 0.5, 0.75];
    let index = 0;
    const random = () => values[index++ % values.length] ?? 0;

    for (let shot = 0; shot < 20; shot += 1) {
      const offset = dispersionOffset(random, 1.5);
      expect(Math.hypot(offset.dx, offset.dz)).toBeLessThanOrEqual(1.5000001);
    }
  });

  it('uses the square root of the random radius so points spread evenly', () => {
    const inner = dispersionOffset(() => 0.0625, 2);
    expect(Math.hypot(inner.dx, inner.dz)).toBeCloseTo(0.5);
  });

  it('moves the aim point by the scatter offset', () => {
    // random() === 0 gives angle 0 and zero distance, so the point is unchanged.
    const centred = scatterAimPoint({ x: 5, z: 5 }, () => 0, 1);
    expect(centred.x).toBeCloseTo(5);
    expect(centred.z).toBeCloseTo(5);

    let call = 0;
    const random = () => (call++ === 0 ? 0 : 1);
    const edge = scatterAimPoint({ x: 5, z: 5 }, random, 2);
    expect(edge.x).toBeCloseTo(7);
    expect(edge.z).toBeCloseTo(5);
  });
});
