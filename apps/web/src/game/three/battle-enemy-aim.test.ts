import { describe, expect, it } from 'vitest';

import { aimEnemyWeapon } from './battle-enemy-aim.js';

describe('enemy weapon aim', () => {
  it('rotates the turret independently of the hull within its traverse limit', () => {
    const aimed = aimEnemyWeapon(
      { turret: 0, pitch: 0 },
      { x: 0, y: 1, z: 0 },
      { x: 0, y: 1, z: 0 },
      { x: 0, y: 1, z: -10 },
      2,
      0.2,
      0.1
    );

    expect(aimed.turret).toBeCloseTo(-0.2);
    expect(aimed.pitch).toBeCloseTo(0);
  });

  it('elevates the gun independently toward the target', () => {
    const aimed = aimEnemyWeapon(
      { turret: 0, pitch: 0 },
      { x: 0, y: 1, z: 0 },
      { x: 0, y: 1, z: 0 },
      { x: 10, y: 4, z: 0 },
      0,
      1,
      0.1
    );

    expect(aimed.pitch).toBeCloseTo(-0.1);
    expect(aimed.turret).toBeCloseTo(0);
  });
});
