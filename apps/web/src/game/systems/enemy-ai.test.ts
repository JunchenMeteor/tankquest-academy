import { describe, expect, it } from 'vitest';

import {
  alertEnemy,
  canEnemyFire,
  clampSearchTarget,
  createEnemyAwareness,
  effectiveEnemyDetectionRange,
  selectEnemyAction,
  shouldAlertFromProjectilePath,
  shouldContinueSearch,
  shouldShareEnemyAlert,
  updateEnemyAwareness,
} from './enemy-ai.js';

describe('enemy AI decisions', () => {
  it('keeps patrol idle and lets only engaged enemies chase or fire', () => {
    expect(selectEnemyAction('patrol', 150, 200)).toBe('idle');
    expect(selectEnemyAction('engaged', 250, 200)).toBe('chase');
    expect(selectEnemyAction('engaged', 150, 200)).toBe('fire');
    expect(selectEnemyAction('searching', 150, 200)).toBe('search');
  });

  it('lets player stealth reduce passive detection range', () => {
    expect(effectiveEnemyDetectionRange(300, 0.76)).toBe(228);
    expect(effectiveEnemyDetectionRange(300, 1)).toBe(300);
  });

  it('remembers only the last passively observed position after losing sight', () => {
    const engaged = updateEnemyAwareness(
      createEnemyAwareness(),
      1_000,
      true,
      { x: 300, y: 180 },
      6_000
    );
    const searching = updateEnemyAwareness(
      engaged,
      2_000,
      false,
      { x: 800, y: 400 },
      6_000
    );

    expect(searching).toEqual({
      state: 'searching',
      alertUntil: 7_000,
      lastKnownPosition: { x: 300, y: 180 },
    });
  });

  it('expires search memory at the configured boundary', () => {
    const searching = alertEnemy(
      createEnemyAwareness(),
      1_000,
      { x: 400, y: 200 },
      5_000
    );

    expect(
      updateEnemyAwareness(searching, 5_999, false, { x: 0, y: 0 }, 5_000).state
    ).toBe('searching');
    expect(
      updateEnemyAwareness(searching, 6_000, false, { x: 0, y: 0 }, 5_000)
    ).toEqual(createEnemyAwareness());
  });

  it('alerts a patrol without granting live player tracking', () => {
    const searching = alertEnemy(
      createEnemyAwareness(),
      2_000,
      { x: 120, y: 270 },
      6_000
    );

    expect(searching).toEqual({
      state: 'searching',
      alertUntil: 8_000,
      lastKnownPosition: { x: 120, y: 270 },
    });
    expect(selectEnemyAction(searching.state, 150, 200)).toBe('search');
  });

  it('detects near misses across the full projectile movement segment', () => {
    const start = { x: 0, y: 0 };
    const end = { x: 120, y: 0 };
    expect(
      shouldAlertFromProjectilePath(start, end, { x: 60, y: 64 }, 64)
    ).toBe(true);
    expect(
      shouldAlertFromProjectilePath(start, end, { x: 60, y: 65 }, 64)
    ).toBe(false);
  });

  it('bounds squad sharing, search stopping, and search leash distance', () => {
    expect(shouldShareEnemyAlert(240, 240)).toBe(true);
    expect(shouldShareEnemyAlert(241, 240)).toBe(false);
    expect(shouldContinueSearch(25)).toBe(true);
    expect(shouldContinueSearch(24)).toBe(false);
    expect(clampSearchTarget({ x: 0, y: 0 }, { x: 600, y: 0 }, 420)).toEqual({
      x: 420,
      y: 0,
    });
  });

  it('honors each enemy fire cooldown', () => {
    expect(canEnemyFire(100, 1499, 1400)).toBe(false);
    expect(canEnemyFire(100, 1500, 1400)).toBe(true);
  });
});
