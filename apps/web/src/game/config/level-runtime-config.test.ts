import type { LevelDto, TankDto } from '@tankquest/shared';
import { describe, expect, it } from 'vitest';

import { levelRuntimeConfig } from './level-runtime-config.js';

const level: LevelDto = {
  id: 'level_1',
  code: 'training',
  titleKey: 'level.training.title',
  mode: 'child_learning',
  baseDifficulty: 1,
  config: { enemyCount: 1 },
};

const tank: TankDto = {
  id: 'tank_1',
  code: 'star-shield',
  nameKey: 'tank.starShield.name',
  role: 'medium',
  stats: { firepower: 4, mobility: 4, armor: 3, stealth: 2, vision: 3 },
};

describe('levelRuntimeConfig', () => {
  it('maps validated level data into the runtime boundary', () => {
    expect(levelRuntimeConfig(level).enemies).toHaveLength(1);
  });

  it('caps content values to the available local prototypes', () => {
    expect(
      levelRuntimeConfig({ ...level, config: { enemyCount: 99 } }).enemies
    ).toHaveLength(2);
  });

  it('maps effective upgrades into perceptible runtime values', () => {
    const config = levelRuntimeConfig(level, tank);

    expect(config.player.speed).toBeGreaterThan(170);
    expect(config.player.acceleration).toBeGreaterThan(420);
    expect(config.player.projectileDamage).toBeGreaterThan(34);
    expect(config.player.projectileSpeed).toBeGreaterThan(460);
    expect(config.player.fireCooldownMs).toBeLessThan(350);
  });
});
