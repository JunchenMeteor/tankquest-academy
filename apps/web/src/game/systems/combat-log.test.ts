import { afterEach, describe, expect, it, vi } from 'vitest';

import { type CombatLogEntry, logCombatEvent } from './combat-log.js';

const target = globalThis as typeof globalThis & {
  __TANKQUEST_COMBAT_LOGS__?: CombatLogEntry[];
};

afterEach(() => {
  delete target.__TANKQUEST_COMBAT_LOGS__;
  vi.restoreAllMocks();
});

describe('combat log', () => {
  it('keeps a bounded structured history', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);

    for (let index = 0; index < 105; index += 1) {
      logCombatEvent('enemy_projectile_hit_player', {
        damage: 10,
        playerHealth: 140 - index,
      });
    }

    expect(target.__TANKQUEST_COMBAT_LOGS__).toHaveLength(100);
    expect(target.__TANKQUEST_COMBAT_LOGS__?.at(-1)).toMatchObject({
      event: 'enemy_projectile_hit_player',
      details: { damage: 10, playerHealth: 36 },
    });
    expect(info).toHaveBeenCalledWith(
      '[TankQuest][combat] enemy_projectile_hit_player',
      { damage: 10, playerHealth: 36 }
    );
  });
});
