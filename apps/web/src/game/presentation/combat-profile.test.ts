import { describe, expect, it } from 'vitest';

import type { EnemyRuntimeConfig } from '../runtime/types.js';
import {
  combatProfileForStats,
  enemyThreatProfiles,
} from './combat-profile.js';

describe('combat profiles', () => {
  it('turns tank ratings into measurable outcomes', () => {
    expect(
      combatProfileForStats({
        firepower: 3,
        mobility: 3,
        armor: 3,
        stealth: 2,
        vision: 3,
      })
    ).toEqual({
      damage: 34,
      detectionRange: 280,
      frontArmor: 78,
      health: 150,
      mass: 110,
      penetration: 82,
      projectileSpeed: 460,
      reloadSeconds: 0.35,
      topSpeed: 170,
      visibilityPercent: 94,
    });
  });

  it('keeps one ordered, config-driven threat profile per enemy role', () => {
    const enemy = (
      role: EnemyRuntimeConfig['role'],
      topSpeed: number,
      health: number,
      frontArmor: number,
      elite = false
    ): EnemyRuntimeConfig => ({
      id: role,
      role,
      elite,
      x: 100,
      y: 100,
      maxHealth: health,
      armorReduction: 0,
      armorProfile: { front: frontArmor, side: 50, rear: 40 },
      mass: 100,
      speed: topSpeed,
      detectionRange: 300,
      attackRange: 200,
      projectileDamage: 20,
      projectilePenetration: 70,
      projectileSpeed: 350,
      fireCooldownMs: 1500,
      alertMemoryMs: 6000,
      nearMissRadius: 64,
      allyAlertRadius: 240,
      searchLeashRange: 560,
    });
    const profiles = enemyThreatProfiles([
      enemy('heavy', 48, 200, 102),
      enemy('scout', 79, 100, 54),
      enemy('medium', 65, 150, 78),
      enemy('scout', 90, 100, 54),
      enemy('heavy', 52, 225, 114, true),
    ]);

    expect(profiles.map((profile) => profile.role)).toEqual([
      'scout',
      'medium',
      'heavy',
      'heavy',
    ]);
    expect(profiles.map((profile) => profile.topSpeed)).toEqual([
      79, 65, 48, 52,
    ]);
    expect(profiles.map((profile) => profile.health)).toEqual([
      100, 150, 200, 225,
    ]);
    expect(profiles.at(-1)?.elite).toBe(true);
  });
});
