import { describe, expect, it } from 'vitest';

import { calculateTankMotion } from './tank-motion.js';

describe('calculateTankMotion', () => {
  it('moves forward along the current hull rotation', () => {
    expect(
      calculateTankMotion(0, 100, 2, {
        forward: true,
        backward: false,
        left: false,
        right: false,
      })
    ).toEqual({ angularVelocity: 0, velocityX: 100, velocityY: 0 });
  });

  it('combines reverse movement and turning without changing speed', () => {
    const result = calculateTankMotion(Math.PI / 2, 80, 3, {
      forward: false,
      backward: true,
      left: true,
      right: false,
    });
    expect(result.angularVelocity).toBe(-3);
    expect(result.velocityX).toBeCloseTo(0);
    expect(result.velocityY).toBeCloseTo(-80);
  });
});
