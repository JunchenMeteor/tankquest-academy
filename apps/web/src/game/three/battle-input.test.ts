import { describe, expect, it } from 'vitest';

import { driveCommand, normaliseAngle } from './battle-input.js';
import type { GameInputSnapshot } from '../input/GameInputController.js';

function snapshot(
  overrides: Partial<GameInputSnapshot> = {}
): GameInputSnapshot {
  return {
    forward: false,
    backward: false,
    left: false,
    right: false,
    aimLeft: false,
    aimRight: false,
    fire: false,
    aimTarget: null,
    ...overrides,
  };
}

describe('3D battle input mapping', () => {
  it('maps forward and backward onto a signed drive value', () => {
    expect(driveCommand(snapshot({ forward: true })).forward).toBe(1);
    expect(driveCommand(snapshot({ backward: true })).forward).toBe(-1);
    expect(
      driveCommand(snapshot({ forward: true, backward: true })).forward
    ).toBe(0);
  });

  it('maps turning and turret controls onto separate axes', () => {
    const command = driveCommand(snapshot({ left: true, aimRight: true }));
    expect(command.turn).toBe(1);
    expect(command.turret).toBe(-1);
  });

  it('keeps a neutral command when nothing is pressed', () => {
    expect(driveCommand(snapshot())).toEqual({
      forward: 0,
      turn: 0,
      turret: 0,
    });
  });

  it('normalises angles into the minus pi to pi range', () => {
    expect(normaliseAngle(Math.PI * 2 + 0.5)).toBeCloseTo(0.5);
    expect(normaliseAngle(-Math.PI * 2 - 0.5)).toBeCloseTo(-0.5);
    expect(normaliseAngle(0.25)).toBeCloseTo(0.25);
  });
});
