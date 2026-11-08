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
      projectilePenetration: 82,
      projectileSpeed: 460,
      fireCooldownMs: 350,
      detectionRange: 280,
    });
  });

  it('makes firepower increase projectile impact and firing performance', () => {
    const low = deriveCombatStats(withStat('firepower', 1));
    const high = deriveCombatStats(withStat('firepower', 5));

    expect(high.projectileDamage).toBeGreaterThan(low.projectileDamage);
    expect(high.projectilePenetration).toBeGreaterThan(
      low.projectilePenetration
    );
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
    expect(high.armorProfile.front).toBeGreaterThan(low.armorProfile.front);
    expect(high.armorProfile.front).toBeGreaterThan(high.armorProfile.side);
    expect(high.armorProfile.side).toBeGreaterThan(high.armorProfile.rear);
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

  it('keeps dispersion small while rewarding accuracy', () => {
    const low = deriveCombatStats(withStat('accuracy', 1));
    const high = deriveCombatStats(withStat('accuracy', 5));

    expect(high.dispersionRadius).toBeLessThan(low.dispersionRadius);
    expect(high.dispersionRadius).toBeGreaterThanOrEqual(0.05);
    expect(low.dispersionRadius).toBeLessThanOrEqual(0.3);
  });

  it('keeps gun elevation independent from horizontal turret traverse', () => {
    const slowGun = deriveCombatStats(withStat('accuracy', 1));
    const fastGun = deriveCombatStats(withStat('accuracy', 5));
    expect(fastGun.gunElevationSpeed).toBeGreaterThan(
      slowGun.gunElevationSpeed ?? 0
    );
    expect(fastGun.turretTraverseSpeed).toBe(slowGun.turretTraverseSpeed);

    const slowTurret = deriveCombatStats(withStat('turretTraverse', 1));
    const fastTurret = deriveCombatStats(withStat('turretTraverse', 5));
    expect(fastTurret.gunElevationSpeed).toBe(slowTurret.gunElevationSpeed);
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
