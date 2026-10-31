import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  audioLoad: vi.fn(),
  audioPlayAmbient: vi.fn(),
  audioShutdown: vi.fn(),
  atmosphereShutdown: vi.fn(),
  feedbackShutdown: vi.fn(),
  release: vi.fn(),
}));

vi.mock('../audio/combat-audio.js', () => ({
  CombatAudio: class {
    load = mocks.audioLoad;
    playAmbient = mocks.audioPlayAmbient;
    shutdown = mocks.audioShutdown;
  },
}));

vi.mock('./combat-feedback-renderer.js', () => ({
  CombatFeedbackRenderer: class {
    shutdown = mocks.feedbackShutdown;
  },
}));

vi.mock('./theme-atmosphere.js', () => ({
  ThemeAtmosphere: class {
    shutdown = mocks.atmosphereShutdown;
  },
}));

vi.mock('./experience-assets.js', () => ({
  EXPERIENCE_GROUND_TEXTURE: 'experience-ground-texture',
  prepareExperienceAssets: () => ({
    audio: [{ key: 'combat-fire', urls: 'blob:fire' }],
    groundTextureUrl: 'blob:ground',
    release: mocks.release,
  }),
}));

vi.mock('../systems/combat-log.js', () => ({ logCombatEvent: vi.fn() }));

import { TrainingExperience } from './training-experience.js';

describe('TrainingExperience lifecycle', () => {
  beforeEach(() => vi.clearAllMocks());

  it('keeps blob URLs alive through create and releases them at shutdown', () => {
    const scene = {
      load: { image: vi.fn() },
      textures: { exists: vi.fn(() => true) },
    };
    const experience = new TrainingExperience(
      scene as never,
      {
        theme: 'training-base',
        visualResources: undefined,
        width: 960,
        height: 540,
      } as never
    );

    experience.preload();
    experience.create();

    expect(scene.load.image).toHaveBeenCalledWith(
      'experience-ground-texture',
      'blob:ground'
    );
    expect(mocks.audioLoad).toHaveBeenCalledOnce();
    expect(mocks.audioPlayAmbient).toHaveBeenCalledWith('training-base');
    expect(mocks.release).not.toHaveBeenCalled();

    experience.shutdown();
    experience.shutdown();

    expect(mocks.release).toHaveBeenCalledOnce();
    expect(mocks.audioShutdown).toHaveBeenCalledTimes(2);
  });
});
