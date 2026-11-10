import { describe, expect, it } from 'vitest';

import {
  ENEMY_STANDOFF,
  advanceEnemy,
  enemyGoal,
  enemyHullHeading,
  enemyReloadMs,
  groupSpread,
  lineOfSightBlocked,
  openingDelayMs,
} from './battle-enemy-ai.js';
import type { BlockPlacement } from './battle-scene-model.js';

const wall: BlockPlacement = {
  position: { x: 6, y: 0.55, z: 0 },
  size: [3, 1.1, 10],
};

const bounds = { width: 80, depth: 60 };

describe('enemy cover logic', () => {
  it('sees a clear line and a blocked one', () => {
    expect(lineOfSightBlocked({ x: 0, z: 0 }, { x: 20, z: 0 }, [])).toBe(false);
    expect(lineOfSightBlocked({ x: 0, z: 0 }, { x: 20, z: 0 }, [wall])).toBe(
      true
    );
    expect(lineOfSightBlocked({ x: 0, z: 20 }, { x: 20, z: 20 }, [wall])).toBe(
      false
    );
  });

  it('stops short of the player instead of driving into it', () => {
    const goal = enemyGoal(
      { position: { x: 0, y: 0, z: 0 } },
      { x: 30, z: 0 },
      0,
      1,
      []
    );
    expect(goal.x).toBeCloseTo(30 - ENEMY_STANDOFF);
    expect(goal.z).toBeCloseTo(0);
  });

  it('spreads a group sideways so they do not stack', () => {
    const left = enemyGoal(
      { position: { x: 0, y: 0, z: 0 } },
      { x: 30, z: 0 },
      0,
      3,
      []
    );
    const right = enemyGoal(
      { position: { x: 0, y: 0, z: 0 } },
      { x: 30, z: 0 },
      2,
      3,
      []
    );
    expect(Math.sign(left.z)).toBe(-Math.sign(right.z));
  });

  it('swings wider when the direct line is blocked', () => {
    const clear = enemyGoal(
      { position: { x: 0, y: 0, z: 0 } },
      { x: 30, z: 0 },
      2,
      3,
      []
    );
    const blocked = enemyGoal(
      { position: { x: 0, y: 0, z: 0 } },
      { x: 30, z: 0 },
      2,
      3,
      [wall]
    );
    expect(Math.abs(blocked.z)).toBeGreaterThan(Math.abs(clear.z));
  });

  it('moves toward the goal and reports the heading', () => {
    const step = advanceEnemy(
      { position: { x: 0, y: 0, z: 0 } },
      { x: 20, z: 0 },
      6,
      1,
      bounds
    );
    expect(step.moved).toBe(true);
    expect(step.position.x).toBeGreaterThan(0);
    expect(Math.abs(step.heading)).toBeLessThan(0.001);
  });

  it('tightens the group as difficulty rises', () => {
    expect(groupSpread(0, 3, 0)).toBeCloseTo(-0.5);
    expect(Math.abs(groupSpread(0, 3, 1))).toBeLessThan(
      Math.abs(groupSpread(0, 3, 0))
    );
  });
});

describe('enemy cadence', () => {
  it('reloads faster as the fight gets harder', () => {
    expect(enemyReloadMs(0)).toBeGreaterThan(enemyReloadMs(1));
    expect(enemyReloadMs(0)).toBe(4600);
    expect(enemyReloadMs(1)).toBe(2400);
  });

  it('staggers the opening shot less as difficulty rises', () => {
    expect(openingDelayMs(2, 0)).toBeGreaterThan(openingDelayMs(2, 1));
    expect(openingDelayMs(0, 0)).toBe(0);
  });
});

describe('role tactics', () => {
  it('sends paired scouts to opposite side/rear lanes', () => {
    const enemy = { position: { x: 0, y: 0, z: 0 } };
    const player = { x: 30, z: 0, heading: 0 };
    const first = enemyGoal(enemy, player, 0, 2, [], 'scout');
    const second = enemyGoal(enemy, player, 1, 2, [], 'scout');
    expect(first.x).toBeCloseTo(26);
    expect(first.z).toBeCloseTo(12);
    expect(second.z).toBeCloseTo(-12);
  });

  it('uses the opposite flank when the preferred firing line is blocked', () => {
    const goal = enemyGoal(
      { position: { x: 0, y: 0, z: 0 } },
      { x: 30, z: 0, heading: 0 },
      0,
      1,
      [
        {
          position: { x: 28, y: 0.55, z: 12 },
          size: [4, 1.1, 6],
        },
      ],
      'scout'
    );
    expect(goal.z).toBeLessThan(0);
  });

  it('keeps medium spacing while heavies press closer', () => {
    const enemy = { position: { x: 0, y: 0, z: 0 } };
    const player = { x: 30, z: 0, heading: 0 };
    const medium = enemyGoal(enemy, player, 0, 1, [], 'medium');
    const heavy = enemyGoal(enemy, player, 0, 1, [], 'heavy');
    expect(medium.x).toBeCloseTo(21);
    expect(heavy.x).toBeCloseTo(23);
    expect(heavy.x).toBeGreaterThan(medium.x);
  });

  it('faces non-scout hulls toward the player during engagement', () => {
    const enemy = { position: { x: 10, y: 0, z: 5 } };
    const player = { x: 0, z: 0 };
    expect(enemyHullHeading(enemy, player, 'heavy', 0)).toBeCloseTo(
      Math.atan2(5, -10)
    );
    expect(enemyHullHeading(enemy, player, 'medium', 0)).toBeCloseTo(
      Math.atan2(5, -10)
    );
    expect(enemyHullHeading(enemy, player, 'scout', 1.23)).toBe(1.23);
  });
});
