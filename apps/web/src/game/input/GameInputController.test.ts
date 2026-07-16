import { describe, expect, it } from 'vitest';

import { GameInputController } from './GameInputController.js';

describe('GameInputController', () => {
  it('keeps a command active until every input source releases it', () => {
    const input = new GameInputController();
    input.setCommand('move-forward', true, 'keyboard');
    input.setCommand('move-forward', true, 'touch');
    input.setCommand('move-forward', false, 'keyboard');

    expect(input.snapshot().forward).toBe(true);
    input.resetSource('touch');
    expect(input.snapshot().forward).toBe(false);
  });

  it('queues one fire edge while preserving held fire', () => {
    const input = new GameInputController();
    input.setCommand('fire', true, 'pointer');

    expect(input.consumeFireRequest()).toBe(true);
    expect(input.consumeFireRequest()).toBe(false);
    expect(input.snapshot().fire).toBe(true);
    input.setCommand('fire', false, 'pointer');
    expect(input.snapshot().fire).toBe(false);
  });

  it('copies aim targets and clears every command on reset', () => {
    const input = new GameInputController();
    input.setAimTarget(320, 240);
    input.setCommand('turn-left', true, 'touch');
    const snapshot = input.snapshot();
    snapshot.aimTarget!.x = 0;

    expect(input.snapshot().aimTarget).toEqual({ x: 320, y: 240 });
    input.resetAll();
    expect(input.snapshot()).toMatchObject({
      left: false,
      fire: false,
      aimTarget: null,
    });
  });

  it('lets relative touch aim take ownership from an old pointer target', () => {
    const input = new GameInputController();
    input.setAimTarget(900, 20);
    input.setCommand('aim-left', true, 'touch');

    expect(input.snapshot()).toMatchObject({ aimLeft: true, aimTarget: null });
  });
});
