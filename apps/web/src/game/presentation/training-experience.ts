import type Phaser from 'phaser';

import { CombatAudio } from '../audio/combat-audio.js';
import type { RuntimeLevelConfig } from '../runtime/types.js';
import type { ProjectileImpactResult } from '../systems/projectile-impact.js';
import { logCombatEvent } from '../systems/combat-log.js';
import { CombatFeedbackRenderer } from './combat-feedback-renderer.js';
import { crossedLowHealthThreshold } from './combat-feedback.js';
import {
  EXPERIENCE_GROUND_TEXTURE,
  prepareExperienceAssets,
  type PreparedExperienceAssets,
} from './experience-assets.js';
import { ThemeAtmosphere } from './theme-atmosphere.js';

export class TrainingExperience {
  private readonly audio: CombatAudio;
  private assets: PreparedExperienceAssets | undefined;
  private feedback: CombatFeedbackRenderer | undefined;
  private atmosphere: ThemeAtmosphere | undefined;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly config: RuntimeLevelConfig
  ) {
    this.audio = new CombatAudio(scene);
  }

  preload() {
    this.assets = prepareExperienceAssets(
      this.config.visualResources,
      this.config.theme
    );
    if (this.assets.groundTextureUrl) {
      try {
        this.scene.load.image(
          EXPERIENCE_GROUND_TEXTURE,
          this.assets.groundTextureUrl
        );
      } catch {
        // Verified experience assets are optional; programmatic ground remains.
      }
    }
    this.audio.load(this.assets.audio);
  }

  create() {
    this.feedback = new CombatFeedbackRenderer(this.scene, this.audio, (cue) =>
      logCombatEvent('feedback_cue', { cue })
    );
    this.atmosphere = new ThemeAtmosphere(
      this.scene,
      this.config.theme,
      this.config.width,
      this.config.height
    );
    this.audio.playAmbient(this.config.theme);
  }

  groundTextureKey() {
    return this.scene.textures.exists(EXPERIENCE_GROUND_TEXTURE)
      ? EXPERIENCE_GROUND_TEXTURE
      : undefined;
  }

  fire(
    x: number,
    y: number,
    rotation: number,
    turret: Phaser.GameObjects.Image
  ) {
    this.feedback?.fire(x, y, rotation, turret);
  }

  reloadReady(x: number, y: number) {
    this.feedback?.reloadReady(x, y);
  }

  impact(
    x: number,
    y: number,
    outcome: ProjectileImpactResult['outcome'],
    playerHit: boolean
  ) {
    this.feedback?.impact(x, y, outcome, playerHit);
  }

  lowHealthIfCrossed(
    previousHealth: number,
    nextHealth: number,
    maxHealth: number,
    x: number,
    y: number
  ) {
    if (crossedLowHealthThreshold(previousHealth, nextHealth, maxHealth)) {
      this.feedback?.lowHealth(x, y);
    }
  }

  destroyed(x: number, y: number, playerDestroyed = false) {
    this.feedback?.destroyed(x, y, playerDestroyed);
  }

  shutdown() {
    this.feedback?.shutdown();
    this.atmosphere?.shutdown();
    this.audio.shutdown();
    this.assets?.release();
    this.feedback = undefined;
    this.atmosphere = undefined;
    this.assets = undefined;
  }
}
