import { describe, expect, it } from 'vitest';

import {
  calculateProjectileImpact,
  classifyArmorZone,
} from './projectile-impact.js';

const mediumArmor = { front: 78, side: 58, rear: 42 };

describe('classifyArmorZone', () => {
  it('uses the impact position relative to the tank rotation', () => {
    expect(classifyArmorZone(20, 0, 0)).toBe('front');
    expect(classifyArmorZone(-20, 0, 0)).toBe('rear');
    expect(classifyArmorZone(0, 20, 0)).toBe('side');
    expect(classifyArmorZone(0, 20, Math.PI / 2)).toBe('front');
  });
});

describe('calculateProjectileImpact', () => {
  it('ricochets a projectile arriving at a grazing angle', () => {
    expect(
      calculateProjectileImpact({
        armor: mediumArmor,
        baseDamage: 34,
        impactOffsetX: 0,
        impactOffsetY: 20,
        penetration: 200,
        projectileVelocityX: 100,
        projectileVelocityY: -10,
        targetRotation: 0,
      })
    ).toMatchObject({ outcome: 'ricochet', zone: 'side', damage: 0 });
  });

  it('blocks a head-on projectile below the effective front armor', () => {
    const impact = calculateProjectileImpact({
      armor: { front: 102, side: 74, rear: 52 },
      baseDamage: 34,
      impactOffsetX: 20,
      impactOffsetY: 0,
      penetration: 82,
      projectileVelocityX: -100,
      projectileVelocityY: 0,
      targetRotation: 0,
    });

    expect(impact).toMatchObject({
      outcome: 'blocked',
      zone: 'front',
      effectiveArmor: 102,
      damage: 0,
    });
  });

  it('penetrates weaker side armor and returns bounded damage', () => {
    const impact = calculateProjectileImpact({
      armor: mediumArmor,
      baseDamage: 34,
      impactOffsetX: 0,
      impactOffsetY: 20,
      penetration: 82,
      projectileVelocityX: 0,
      projectileVelocityY: -100,
      targetRotation: 0,
    });

    expect(impact).toMatchObject({
      outcome: 'penetrated',
      zone: 'side',
      effectiveArmor: 58,
    });
    expect(impact.damage).toBeGreaterThan(0);
    expect(impact.damage).toBeLessThanOrEqual(34);
  });

  it('sanitizes invalid combat values deterministically', () => {
    expect(
      calculateProjectileImpact({
        armor: { front: Number.NaN, side: -1, rear: 0 },
        baseDamage: Number.NaN,
        impactOffsetX: Number.NaN,
        impactOffsetY: Number.NaN,
        penetration: Number.NaN,
        projectileVelocityX: 0,
        projectileVelocityY: 0,
        targetRotation: Number.NaN,
      })
    ).toEqual({
      outcome: 'blocked',
      zone: 'front',
      impactAngleDegrees: 0,
      baseArmor: 1,
      effectiveArmor: 1,
      penetration: 0,
      damage: 0,
    });
  });
});
