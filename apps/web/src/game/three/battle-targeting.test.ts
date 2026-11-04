import { BoxGeometry, Mesh, MeshBasicMaterial, Ray, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';

import { resolveAimPoint } from './battle-aim.js';

function targetAt(y: number, z: number): Mesh {
  const target = new Mesh(new BoxGeometry(2, 2, 2), new MeshBasicMaterial());
  target.position.set(0, y, z);
  target.updateMatrixWorld(true);
  return target;
}

describe('reticle target resolution', () => {
  it('uses the actual surface hit rather than a fixed-range point', () => {
    const target = targetAt(1, 0);
    const origin = new Vector3(0, 5, 10);
    const direction = new Vector3(0, 1, 0).sub(origin).normalize();

    const point = resolveAimPoint(new Ray(origin, direction), [target], 46);

    expect(point.distanceTo(new Vector3(0, 1.4, 1))).toBeLessThan(0.000001);
  });

  it('selects the nearest target along the reticle ray', () => {
    const far = targetAt(0, 0);
    const near = targetAt(0, 5);

    const point = resolveAimPoint(
      new Ray(new Vector3(0, 0, 10), new Vector3(0, 0, -1)),
      [far, near],
      46
    );

    expect(point.z).toBeCloseTo(6);
  });

  it('uses maximum range only when nothing is hit', () => {
    const origin = new Vector3(0, 5, 10);
    const direction = new Vector3(0, 1, 0);

    const point = resolveAimPoint(new Ray(origin, direction), [], 46);

    expect(
      point.distanceTo(origin.clone().addScaledVector(direction, 46))
    ).toBeLessThan(0.000001);
  });
});
