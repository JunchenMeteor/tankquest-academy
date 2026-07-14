import type { TankStats } from '@tankquest/shared';
import { describe, expect, it } from 'vitest';

import { baselineTankStats, deriveCombatStats } from './combat-stats.js';

function withStat(stat: keyof TankStats, value: number): TankStats {
  return { ...baselineTankStats, [stat]: value };
}

describe('deriveCombatStats', () => {
  it('preserves the established level-three movement and projectile baseline', () => {
    expect(deriveCombatStats(baselineTankStats)).toMatchObject({
      maxHealth: 150,
      mass: 110,
      speed: 170,
      turnSpeed: 2.8,
      projectileDamage: 34,
      projectileSpeed: 460,
      fireCooldownMs: 350,
      detectionRange: 280,
    });
  });

  it('makes firepower increase projectile impact and firing performance', () => {
    const low = deriveCombatStats(withStat('firepower', 1));
    const high = deriveCombatStats(withStat('firepower', 5));

    expect(high.projectileDamage).toBeGreaterThan(low.projectileDamage);
    expect(high.projectileSpeed).toBeGreaterThan(low.projectileSpeed);
    expect(high.fireCooldownMs).toBeLessThan(low.fireCooldownMs);
  });

  it('makes mobility improve forward, reverse, acceleration, and turning', () => {
    const low = deriveCombatStats(withStat('mobility', 1));
    const high = deriveCombatStats(withStat('mobility', 5));

    expect(high.speed).toBeGreaterThan(low.speed);
    expect(high.reverseSpeed).toBeGreaterThan(low.reverseSpeed);
    expect(high.acceleration).toBeGreaterThan(low.acceleration);
    expect(high.turnSpeed).toBeGreaterThan(low.turnSpeed);
  });

  it('makes armor improve survivability and mass', () => {
    const low = deriveCombatStats(withStat('armor', 1));
    const high = deriveCombatStats(withStat('armor', 5));

    expect(high.maxHealth).toBeGreaterThan(low.maxHealth);
    expect(high.armorReduction).toBeGreaterThan(low.armorReduction);
    expect(high.mass).toBeGreaterThan(low.mass);
  });

  it('makes stealth harder to detect and vision extend detection range', () => {
    const visible = deriveCombatStats(withStat('stealth', 1));
    const concealed = deriveCombatStats(withStat('stealth', 5));
    const shortVision = deriveCombatStats(withStat('vision', 1));
    const longVision = deriveCombatStats(withStat('vision', 5));

    expect(concealed.visibilityMultiplier).toBeLessThan(
      visible.visibilityMultiplier
    );
    expect(longVision.detectionRange).toBeGreaterThan(
      shortVision.detectionRange
    );
  });

  it('clamps unexpected API values to the supported one-to-five range', () => {
    expect(deriveCombatStats(withStat('firepower', 99))).toEqual(
      deriveCombatStats(withStat('firepower', 5))
    );
    expect(deriveCombatStats(withStat('armor', Number.NaN))).toEqual(
      deriveCombatStats(withStat('armor', 3))
    );
  });
});
