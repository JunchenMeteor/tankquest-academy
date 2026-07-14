import { describe, expect, it } from 'vitest';

import {
  canEnemyFire,
  effectiveEnemyDetectionRange,
  selectEnemyAction,
} from './enemy-ai.js';

describe('enemy AI decisions', () => {
  it('transitions from idle to chase to fire by configured distance', () => {
    expect(selectEnemyAction(350, 300, 200)).toBe('idle');
    expect(selectEnemyAction(250, 300, 200)).toBe('chase');
    expect(selectEnemyAction(150, 300, 200)).toBe('fire');
  });

  it('lets player stealth reduce the effective detection range', () => {
    expect(effectiveEnemyDetectionRange(300, 0.76)).toBe(228);
    expect(effectiveEnemyDetectionRange(300, 1)).toBe(300);
  });

  it('honors each enemy fire cooldown', () => {
    expect(canEnemyFire(100, 1499, 1400)).toBe(false);
    expect(canEnemyFire(100, 1500, 1400)).toBe(true);
  });
});
