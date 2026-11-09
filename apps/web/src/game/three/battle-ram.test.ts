import { describe, expect, it } from 'vitest';

import { createCombatState } from './battle-combat.js';
import {
  applyRamImpacts,
  calculateRamImpacts,
  type RamBody3D,
  type RamImpact3D,
} from './battle-ram.js';

function body(id: string, currentX: number, previousX = currentX): RamBody3D {
  return {
    id,
    mass: id === 'player' ? 140 : 60,
    armorReduction: 0.1,
    radius: 2.6,
    previous: { x: previousX, z: 0 },
    current: { x: currentX, z: 0 },
  };
}

const impact = (
  damageToFirst: number,
  damageToSecond: number
): RamImpact3D => ({
  pairKey: 'player:enemy',
  firstId: 'player',
  secondId: 'enemy',
  damageToFirst,
  damageToSecond,
  relativeSpeed: 100,
});

describe('3D ram impacts', () => {
  it('uses measured world velocity and damages both tanks on contact', () => {
    const impacts = calculateRamImpacts(
      [body('player', 0, -4), body('enemy', 2)],
      1,
      new Map(),
      1_000
    );

    expect(impacts).toHaveLength(1);
    expect(impacts[0]).toMatchObject({
      pairKey: 'player:enemy',
      relativeSpeed: (4 * 170) / 6,
    });
    expect(impacts[0]!.damageToFirst).toBeGreaterThan(0);
    expect(impacts[0]!.damageToSecond).toBeGreaterThan(0);
  });

  it('ignores low-speed contact and enemy-only collisions', () => {
    expect(
      calculateRamImpacts(
        [body('player', 0, -0.5), body('enemy', 2)],
        1,
        new Map(),
        1_000
      )
    ).toEqual([]);
    expect(
      calculateRamImpacts(
        [body('first', 0, -4), body('second', 2)],
        1,
        new Map(),
        1_000
      )
    ).toEqual([]);
  });

  it('lets a heavier tank transfer more damage than it receives', () => {
    const impacts = calculateRamImpacts(
      [
        { ...body('player', 0, -4), mass: 200 },
        { ...body('enemy', 2), mass: 50 },
      ],
      1,
      new Map(),
      1_000
    );

    expect(impacts[0]!.damageToSecond).toBeGreaterThan(
      impacts[0]!.damageToFirst
    );
  });

  it('applies a cooldown independently to each tank pair', () => {
    const bodies = [body('player', 0, -4), body('enemy', 2)];
    expect(
      calculateRamImpacts(bodies, 1, new Map([['player:enemy', 500]]), 1_000)
    ).toEqual([]);
    expect(
      calculateRamImpacts(bodies, 1, new Map([['player:enemy', 350]]), 1_000)
    ).toHaveLength(1);
  });

  it('ignores exact overlap instead of producing invalid damage', () => {
    expect(
      calculateRamImpacts(
        [body('player', 0, -4), body('enemy', 0)],
        1,
        new Map(),
        1_000
      )
    ).toEqual([]);
  });

  it('applies damage and counts each ram kill once', () => {
    const initial = {
      ...createCombatState(2, 1, 150),
      enemyHealth: { enemy: 40, other: 100 },
    };
    const killed = applyRamImpacts(initial, [impact(20, 45)]);

    expect(killed.state).toMatchObject({
      playerHealth: 130,
      enemiesRemaining: 1,
      enemyHealth: { enemy: 0, other: 100 },
    });
    expect(killed.destroyed).toEqual(['enemy']);

    const repeated = applyRamImpacts(killed.state, [impact(20, 45)]);
    expect(repeated.state).toBe(killed.state);
    expect(repeated.destroyed).toEqual([]);
  });
});
