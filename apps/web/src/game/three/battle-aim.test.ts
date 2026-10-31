import { describe, expect, it } from 'vitest';

import { aimYaw, dispersionOffset, rotateTowards, scatterAimPoint } from './battle-aim.js';

describe('3D battle aiming', () => {
  it('points at a target with the same convention as the hull heading', () => {
    expect(aimYaw({ x: 0, z: 0 }, { x: 10, z: 0 })).toBeCloseTo(0);
    expect(aimYaw({ x: 0, z: 0 }, { x: 0, z: 10 })).toBeCloseTo(-Math.PI / 2);
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
