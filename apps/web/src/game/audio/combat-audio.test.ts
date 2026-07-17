import { describe, expect, it, vi } from 'vitest';

import {
  ambientAudioKey,
  CombatAudio,
  combatAudioKey,
} from './combat-audio.js';

function scene(options: { locked?: boolean; available?: string[] } = {}) {
  const available = new Set(options.available ?? []);
  const listeners = new Map<string, () => void>();
  const audio = vi.fn((key: string) => available.add(key));
  const play = vi.fn(() => true);
  const stopByKey = vi.fn(() => 1);
  const setMute = vi.fn();
  const sound = {
    locked: options.locked ?? false,
    off: vi.fn((event: string) => listeners.delete(event)),
    once: vi.fn((event: string, listener: () => void) => {
      listeners.set(event, listener);
      return sound;
    }),
    play,
    setMute,
    stopByKey,
  };
  return {
    value: {
      cache: { audio: { exists: (key: string) => available.has(key) } },
      load: { audio },
      sound,
    } as never,
    audio,
    listeners,
    play,
    setMute,
    sound,
    stopByKey,
  };
}

describe('CombatAudio', () => {
  it('queues assets once and safely plays a bounded effect', () => {
    const mock = scene();
    const audio = new CombatAudio(mock.value);
    audio.load([
      { key: combatAudioKey('fire'), urls: '/fire.ogg' },
      { key: combatAudioKey('fire'), urls: '/duplicate.ogg' },
    ]);

    expect(mock.audio).toHaveBeenCalledOnce();
    expect(audio.play('fire', 10, 10)).toBe(true);
    expect(mock.play).toHaveBeenCalledWith(combatAudioKey('fire'), {
      rate: 1.25,
      volume: 0.8,
    });
  });

  it('defers ambient playback until Phaser unlocks audio', () => {
    const key = ambientAudioKey('snow-field');
    const mock = scene({ locked: true, available: [key] });
    const audio = new CombatAudio(mock.value);

    expect(audio.playAmbient('snow-field', 1)).toBe(false);
    expect(mock.play).not.toHaveBeenCalled();
    mock.sound.locked = false;
    mock.listeners.get('unlocked')?.();

    expect(mock.play).toHaveBeenCalledWith(key, {
      loop: true,
      volume: 0.2,
    });
  });

  it('mutes, stops ambience, and releases listeners during shutdown', () => {
    const ambient = ambientAudioKey('forest-camp');
    const effect = combatAudioKey('destroyed');
    const mock = scene({ available: [ambient, effect] });
    const audio = new CombatAudio(mock.value);
    audio.load([{ key: effect, urls: ['/destroyed.ogg'] }]);
    expect(audio.playAmbient('forest-camp')).toBe(true);

    audio.setMuted(true);
    expect(mock.setMute).toHaveBeenCalledWith(true);
    expect(mock.stopByKey).toHaveBeenCalledWith(ambient);
    expect(audio.play('destroyed', 0.7)).toBe(false);

    audio.setMuted(false);
    expect(mock.play).toHaveBeenLastCalledWith(ambient, {
      loop: true,
      volume: 0.12,
    });

    audio.shutdown();
    expect(mock.stopByKey).toHaveBeenCalledWith(effect);
    expect(audio.playAmbient('forest-camp')).toBe(false);
  });

  it('treats missing caches and Phaser exceptions as no-op', () => {
    const mock = scene();
    mock.play.mockImplementation(() => {
      throw new Error('audio unavailable');
    });
    const audio = new CombatAudio(mock.value);

    expect(audio.play('blocked', 0.4)).toBe(false);
    expect(audio.playAmbient('training-base')).toBe(false);
    expect(() => audio.shutdown()).not.toThrow();
  });
});
