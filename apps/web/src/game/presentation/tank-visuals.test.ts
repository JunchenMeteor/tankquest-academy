import { describe, expect, it } from 'vitest';

import { resolvePlayerTankVisual } from './tank-visual-definition.js';
import { turretOrigin } from './tank-visuals.js';

describe('tank visual presentation helpers', () => {
  it('anchors the layered turret at its rotation center', () => {
    const definition = resolvePlayerTankVisual('iron-mountain');
    const origin = turretOrigin(definition);

    expect(origin.x).toBeGreaterThan(0);
    expect(origin.x).toBeLessThan(0.5);
    expect(origin.y).toBe(0.5);
  });
});
