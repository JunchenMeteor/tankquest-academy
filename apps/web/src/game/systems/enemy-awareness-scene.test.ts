import type Phaser from 'phaser';
import { describe, expect, it } from 'vitest';

import {
  alertEnemiesAlongProjectilePath,
  alertEnemySquad,
  projectileSourcePosition,
  resolveEnemyAwarenessDecision,
} from './enemy-awareness-scene.js';

describe('enemy awareness scene adapter', () => {
  it('alerts once for a terminal projectile path even after the projectile deactivates', () => {
    const enemy = fakeSprite('enemy', 80, 60);
    const enemies = fakeGroup([enemy]);
    const projectile = fakeSprite('projectile', 120, 0, false, {
      previousX: 0,
      previousY: 0,
      sourceX: 10,
      sourceY: 5,
      alertedEnemyIds: [],
    });

    alertEnemiesAlongProjectilePath(projectile, enemies, 1_000);
    const firstAlertUntil = enemy.getData('alertUntil');
    alertEnemiesAlongProjectilePath(projectile, enemies, 2_000);

    expect(enemy.getData('awarenessState')).toBe('searching');
    expect(firstAlertUntil).toBe(7_000);
    expect(enemy.getData('alertUntil')).toBe(firstAlertUntil);
    expect(projectile.getData('alertedEnemyIds')).toEqual(['enemy']);
    expect(projectileSourcePosition(projectile, { x: 0, y: 0 })).toEqual({
      x: 10,
      y: 5,
    });
  });

  it('shares alerts only with nearby active squad members', () => {
    const source = fakeSprite('source', 0, 0);
    const near = fakeSprite('near', 200, 0);
    const far = fakeSprite('far', 241, 0);
    const inactive = fakeSprite('inactive', 100, 0, false);
    const enemies = fakeGroup([source, near, far, inactive]);

    alertEnemySquad(enemies, source, 1_000, { x: 600, y: 0 }, 'direct_hit');

    expect(source.getData('awarenessState')).toBe('searching');
    expect(near.getData('awarenessState')).toBe('searching');
    expect(far.getData('awarenessState')).toBe('patrol');
    expect(inactive.getData('awarenessState')).toBe('patrol');
  });

  it('applies the search leash when an engaged enemy loses passive detection', () => {
    const enemy = fakeSprite('enemy', 0, 0, true, {
      awarenessState: 'engaged',
      alertUntil: 10_000,
      lastKnownX: 800,
      lastKnownY: 0,
      detectionRange: 100,
      attackRange: 80,
      searchLeashRange: 300,
    });

    const decision = resolveEnemyAwarenessDecision(
      enemy,
      2_000,
      { x: 900, y: 0 },
      1
    );

    expect(decision.action).toBe('search');
    expect(decision.targetPosition).toEqual({ x: 300, y: 0 });
    expect(enemy.getData('lastKnownX')).toBe(300);
  });
});

function fakeSprite(
  id: string,
  x: number,
  y: number,
  active = true,
  overrides: Record<string, unknown> = {}
) {
  const data = new Map<string, unknown>(
    Object.entries({
      id,
      awarenessState: 'patrol',
      alertUntil: 0,
      lastKnownX: undefined,
      lastKnownY: undefined,
      homeX: x,
      homeY: y,
      alertMemoryMs: 6000,
      nearMissRadius: 64,
      allyAlertRadius: 240,
      searchLeashRange: 560,
      detectionRange: 300,
      attackRange: 200,
      ...overrides,
    })
  );
  return {
    x,
    y,
    active,
    getData(key: string) {
      return data.get(key);
    },
    setData(keyOrValues: string | Record<string, unknown>, value?: unknown) {
      if (typeof keyOrValues === 'string') {
        data.set(keyOrValues, value);
      } else {
        for (const [key, nextValue] of Object.entries(keyOrValues)) {
          data.set(key, nextValue);
        }
      }
      return this;
    },
  } as unknown as Phaser.Physics.Arcade.Sprite;
}

function fakeGroup(children: Phaser.Physics.Arcade.Sprite[]) {
  return { children } as unknown as Phaser.Physics.Arcade.Group;
}
