import { describe, expect, it } from 'vitest';

import { calculateArmoredDamage, healthAfterDamage } from './combat-damage.js';

describe('calculateArmoredDamage', () => {
  it('applies armor mitigation to incoming projectile damage', () => {
    expect(calculateArmoredDamage(40, 0)).toBe(40);
    expect(calculateArmoredDamage(40, 0.25)).toBe(30);
  });

  it('keeps a positive hit meaningful and bounds invalid mitigation', () => {
    expect(calculateArmoredDamage(1, 0.75)).toBe(1);
    expect(calculateArmoredDamage(40, 9)).toBe(10);
    expect(calculateArmoredDamage(-10, 0)).toBe(0);
  });
});

describe('healthAfterDamage', () => {
  it('never produces negative health or heals from negative damage', () => {
    expect(healthAfterDamage(20, 25)).toBe(0);
    expect(healthAfterDamage(20, -5)).toBe(20);
  });
});
