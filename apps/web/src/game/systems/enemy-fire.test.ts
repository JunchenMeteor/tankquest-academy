import { describe, expect, it, vi } from 'vitest';

import { fireEnemyProjectile } from './enemy-fire.js';

function setup(lastShotAt = 0) {
  const data = new Map<string, unknown>([
    ['lastShotAt', lastShotAt],
    ['fireCooldownMs', 500],
    ['projectileDamage', 12],
    ['projectilePenetration', 24],
    ['projectileSpeed', 300],
  ]);
  const projectile = {
    active: true,
    body: { velocity: {} },
    destroy: vi.fn(),
    setActive: vi.fn(),
    setData: vi.fn(),
    setRotation: vi.fn(),
    setVisible: vi.fn(),
  };
  projectile.setActive.mockReturnValue(projectile);
  projectile.setVisible.mockReturnValue(projectile);
  projectile.setData.mockReturnValue(projectile);
  const enemy = {
    getData: (key: string) => data.get(key),
    setData: vi.fn((key: string, value: unknown) => data.set(key, value)),
  };
  const scene = {
    physics: { velocityFromRotation: vi.fn() },
    time: { delayedCall: vi.fn() },
  };
  const projectiles = { get: vi.fn(() => projectile) };
  const turret = { x: 10, y: 20, rotation: 0.5 };
  return { data, enemy, projectile, projectiles, scene, turret };
}

describe('fireEnemyProjectile', () => {
  it('reports whether a projectile was actually fired', () => {
    const ready = setup();

    expect(
      fireEnemyProjectile(
        ready.scene as never,
        ready.projectiles as never,
        ready.enemy as never,
        ready.turret as never,
        1_000
      )
    ).toBe(true);
    expect(ready.enemy.setData).toHaveBeenCalledWith('lastShotAt', 1_000);
    expect(ready.projectiles.get).toHaveBeenCalledWith(
      10,
      20,
      'enemy-projectile'
    );

    const coolingDown = setup(900);
    expect(
      fireEnemyProjectile(
        coolingDown.scene as never,
        coolingDown.projectiles as never,
        coolingDown.enemy as never,
        coolingDown.turret as never,
        1_000
      )
    ).toBe(false);
    expect(coolingDown.projectiles.get).not.toHaveBeenCalled();
  });
});
