import type { LevelDto } from '@tankquest/shared';
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

describe('levelRuntimeConfig', () => {
  it('maps validated level data into the runtime boundary', () => {
    expect(levelRuntimeConfig(level).enemies).toHaveLength(1);
  });

  it('caps content values to the available local prototypes', () => {
    expect(
      levelRuntimeConfig({ ...level, config: { enemyCount: 99 } }).enemies
    ).toHaveLength(2);
  });
});
