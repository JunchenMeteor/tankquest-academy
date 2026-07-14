import { describe, expect, it } from 'vitest';

import {
  calculateRamDamage,
  isRamDamageReady,
  ramDamageCooldownMs,
  type RamBodyState,
} from './ram-collision.js';

const first: RamBodyState = {
  armorReduction: 0.12,
  mass: 110,
  velocityX: 170,
  velocityY: 0,
  x: 0,
  y: 0,
};

const second: RamBodyState = {
  armorReduction: 0.08,
  mass: 80,
  velocityX: 0,
  velocityY: 0,
  x: 40,
  y: 0,
};

describe('calculateRamDamage', () => {
  it('ignores stationary and low-speed contact', () => {
    expect(
      calculateRamDamage({ ...first, velocityX: 35 }, second)
    ).toMatchObject({ damageToFirst: 0, damageToSecond: 0 });
  });

  it('damages both tanks during a meaningful head-on impact', () => {
    const impact = calculateRamDamage(first, {
      ...second,
      velocityX: -55,
    });

    expect(impact.relativeSpeed).toBe(225);
    expect(impact.damageToFirst).toBeGreaterThan(0);
    expect(impact.damageToSecond).toBeGreaterThan(impact.damageToFirst);
  });

  it('lets a heavier tank transfer more damage than it receives', () => {
    const impact = calculateRamDamage(
      { ...first, mass: 150 },
      { ...second, mass: 70 }
    );

    expect(impact.damageToSecond).toBeGreaterThan(impact.damageToFirst);
  });

  it('reduces received damage with armor and caps extreme impacts', () => {
    const unarmored = calculateRamDamage(first, second).damageToFirst;
    const armored = calculateRamDamage(
      { ...first, armorReduction: 0.5 },
      second
    ).damageToFirst;
    const extreme = calculateRamDamage({ ...first, velocityX: 10_000 }, second);

    expect(armored).toBeLessThan(unarmored);
    expect(extreme.damageToFirst).toBeLessThanOrEqual(45);
    expect(extreme.damageToSecond).toBeLessThanOrEqual(45);
  });
});

describe('isRamDamageReady', () => {
  it('requires a cooldown between repeated damage from the same pair', () => {
    expect(isRamDamageReady(undefined, 100)).toBe(true);
    expect(isRamDamageReady(100, 100 + ramDamageCooldownMs - 1)).toBe(false);
    expect(isRamDamageReady(100, 100 + ramDamageCooldownMs)).toBe(true);
  });
});
