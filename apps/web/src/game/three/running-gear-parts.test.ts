import { BoxGeometry, Group, Mesh } from 'three';
import { describe, expect, it } from 'vitest';

import { normalise } from './tank-asset.js';

describe('running gear visual parts', () => {
  it('attaches sprocket teeth to their wheels and suspension to the hull', () => {
    const root = new Group();
    const hull = new Group();
    hull.name = 'Hull';
    root.add(hull);
    for (const side of ['L', 'R']) {
      for (let index = 0; index <= 6; index += 1) {
        const wheel = new Mesh(new BoxGeometry(28, 110, 110));
        wheel.name = `Wheel_${side}_${String(index).padStart(2, '0')}`;
        wheel.position.set(side === 'L' ? -140 : 140, 62.8, 150 - index * 95);
        hull.add(wheel);
      }
    }

    normalise(root);

    expect(root.getObjectByName('SprocketTooth_L_06_00')?.parent?.name).toBe(
      'Wheel_L_06'
    );
    expect(root.getObjectByName('SprocketTooth_R_06_11')?.parent?.name).toBe(
      'Wheel_R_06'
    );
    expect(
      root
        .getObjectsByProperty('type', 'Mesh')
        .filter((mesh) => mesh.name.startsWith('SprocketTooth_'))
    ).toHaveLength(24);
    expect(root.getObjectByName('ReturnRoller_L_01')?.parent?.name).toBe(
      'Hull'
    );
    expect(root.getObjectByName('Suspension_R_05')?.parent?.name).toBe('Hull');
    expect(
      root.getObjectByName('ReturnRoller_L_01')?.userData.rollingRadius
    ).toBeGreaterThan(0);
  });
});
