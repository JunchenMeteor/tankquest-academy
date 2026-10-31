import type Phaser from 'phaser';

import type { CombatFeedbackCue } from '../presentation/combat-feedback.js';

export const ambientAudioThemes = [
  'training-base',
  'forest-camp',
  'snow-field',
] as const;

export type AmbientAudioTheme = (typeof ambientAudioThemes)[number];

export interface CombatAudioAsset {
  readonly key: string;
  readonly urls: string | readonly string[];
}

type AudioScene = Pick<Phaser.Scene, 'cache' | 'load' | 'sound'>;

const cueKeys: Readonly<Record<CombatFeedbackCue, string>> = {
  fire: 'combat-fire',
  'reload-ready': 'combat-reload-ready',
  ricochet: 'combat-ricochet',
  blocked: 'combat-blocked',
  penetrated: 'combat-penetrated',
  'low-health': 'combat-low-health',
  destroyed: 'combat-destroyed',
};

const ambientKeys: Readonly<Record<AmbientAudioTheme, string>> = {
  'training-base': 'ambient-training-base',
  'forest-camp': 'ambient-forest-camp',
  'snow-field': 'ambient-snow-field',
};

const AUDIO_LIMITS = {
  effectVolume: 0.8,
  ambientVolume: 0.2,
  minRate: 0.75,
  maxRate: 1.25,
} as const;

export class CombatAudio {
  private readonly loadedKeys = new Set<string>();
  private ambientKey: string | undefined;
  private desiredAmbient:
    { theme: AmbientAudioTheme; volume: number } | undefined;
  private pendingAmbient: { key: string; volume: number } | undefined;
  private muted = false;
  private stopped = false;
  private unlockListener: (() => void) | undefined;

  constructor(private readonly scene: AudioScene) {}

  load(assets: readonly CombatAudioAsset[]) {
    if (this.stopped) return;
    for (const asset of assets) {
      if (!asset.key || this.loadedKeys.has(asset.key)) continue;
      try {
        if (!this.scene.cache.audio.exists(asset.key)) {
          this.scene.load.audio(asset.key, [...toUrls(asset.urls)]);
        }
        this.loadedKeys.add(asset.key);
      } catch {
        // Audio is optional presentation. A failed queue must not block play.
      }
    }
  }

  play(cue: CombatFeedbackCue, volume: number, rate = 1) {
    if (this.stopped || this.muted) return false;
    return this.playKey(cueKeys[cue], {
      volume: clamp(volume, 0, AUDIO_LIMITS.effectVolume),
      rate: clamp(rate, AUDIO_LIMITS.minRate, AUDIO_LIMITS.maxRate),
    });
  }

  playAmbient(theme: AmbientAudioTheme, volume = 0.12) {
    if (this.stopped) return false;
    const key = ambientKeys[theme];
    const boundedVolume = clamp(volume, 0, AUDIO_LIMITS.ambientVolume);
    this.desiredAmbient = { theme, volume: boundedVolume };
    if (this.muted) return false;

    try {
      if (this.scene.sound.locked) {
        this.pendingAmbient = { key, volume: boundedVolume };
        this.listenForUnlock();
        return false;
      }
    } catch {
      return false;
    }

    return this.startAmbient(key, boundedVolume);
  }

  setMuted(muted: boolean) {
    if (this.stopped) return;
    const changed = this.muted !== muted;
    this.muted = muted;
    this.pendingAmbient = undefined;
    try {
      this.scene.sound.setMute(muted);
    } catch {
      // NoAudio and partially initialized managers are valid fallbacks.
    }
    if (muted) {
      this.stopAmbientPlayback();
    } else if (changed && this.desiredAmbient) {
      this.playAmbient(this.desiredAmbient.theme, this.desiredAmbient.volume);
    }
  }

  stopAmbient() {
    this.desiredAmbient = undefined;
    this.pendingAmbient = undefined;
    this.stopAmbientPlayback();
  }

  private stopAmbientPlayback() {
    if (!this.ambientKey) return;
    try {
      this.scene.sound.stopByKey(this.ambientKey);
    } catch {
      // Shutdown and decode failures must remain non-fatal.
    }
    this.ambientKey = undefined;
  }

  shutdown() {
    if (this.stopped) return;
    this.stopAmbient();
    if (this.unlockListener) {
      try {
        this.scene.sound.off('unlocked', this.unlockListener);
      } catch {
        // The manager may already have been destroyed by Phaser.
      }
    }
    this.unlockListener = undefined;
    this.pendingAmbient = undefined;
    for (const key of this.loadedKeys) {
      try {
        this.scene.sound.stopByKey(key);
      } catch {
        // Individual sound failures do not prevent the remaining cleanup.
      }
    }
    this.loadedKeys.clear();
    this.stopped = true;
  }

  private listenForUnlock() {
    if (this.unlockListener) return;
    this.unlockListener = () => {
      this.unlockListener = undefined;
      const pending = this.pendingAmbient;
      this.pendingAmbient = undefined;
      if (!pending || this.stopped || this.muted) return;
      this.startAmbient(pending.key, pending.volume);
    };
    try {
      this.scene.sound.once('unlocked', this.unlockListener);
    } catch {
      this.unlockListener = undefined;
      this.pendingAmbient = undefined;
    }
  }

  private startAmbient(key: string, volume: number) {
    if (this.ambientKey === key) return true;
    this.stopAmbientPlayback();
    const started = this.playKey(key, { loop: true, volume });
    if (started) this.ambientKey = key;
    return started;
  }

  private playKey(key: string, config: Phaser.Types.Sound.SoundConfig) {
    try {
      if (!this.scene.cache.audio.exists(key)) return false;
      return this.scene.sound.play(key, config);
    } catch {
      return false;
    }
  }
}

export function combatAudioKey(cue: CombatFeedbackCue) {
  return cueKeys[cue];
}

export function ambientAudioKey(theme: AmbientAudioTheme) {
  return ambientKeys[theme];
}

function toUrls(urls: CombatAudioAsset['urls']) {
  return typeof urls === 'string' ? [urls] : urls;
}

function clamp(value: number, minimum: number, maximum: number) {
  if (!Number.isFinite(value)) return minimum;
  return Math.min(maximum, Math.max(minimum, value));
}
