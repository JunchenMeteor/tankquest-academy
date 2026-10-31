import type Phaser from 'phaser';
import { describe, expect, it, vi } from 'vitest';

import { localTrainingConfig } from '../config/local-training-config.js';
import { applyRamImpact } from './ram-combat.js';

describe('applyRamImpact', () => {
  it('reports a collision kill so the scene can advance mission objectives', () => {
    const label = {
      y: 0,
      destroy: vi.fn(),
      setDepth: vi.fn(),
      setOrigin: vi.fn(),
    };
    label.setDepth.mockReturnValue(label);
    label.setOrigin.mockReturnValue(label);
    const scene = {
      add: { text: vi.fn(() => label) },
      tweens: { add: vi.fn() },
    } as unknown as Phaser.Scene;
    const playerData = new Map<string, unknown>([
      ['impactVelocityX', 400],
      ['impactVelocityY', 0],
    ]);
    const player = {
      active: true,
      x: 100,
      y: 100,
      getData: (key: string) => playerData.get(key),
    } as unknown as Phaser.Physics.Arcade.Sprite;
    const healthBar = { destroy: vi.fn() };
    const turret = { destroy: vi.fn() };
    const enemyData = new Map<string, unknown>([
      ['id', 'ram_target'],
      ['armorReduction', 0],
      ['mass', 30],
      ['impactVelocityX', 0],
      ['impactVelocityY', 0],
      ['health', 40],
      ['healthBar', healthBar],
      ['turret', turret],
    ]);
    const destroy = vi.fn();
    const enemy = {
      active: true,
      x: 110,
      y: 100,
      destroy,
      getData: (key: string) => enemyData.get(key),
      setData: (key: string, value: unknown) => enemyData.set(key, value),
    } as unknown as Phaser.Physics.Arcade.Sprite;

    expect(
      applyRamImpact(
        scene,
        player,
        enemy,
        { ...localTrainingConfig.player, mass: 140 },
        150,
        undefined,
        1_000
      )
    ).toMatchObject({
      enemyId: 'ram_target',
      enemyDestroyed: true,
    });
    expect(destroy).toHaveBeenCalledOnce();
  });
});
