import type Phaser from 'phaser';

import type { CombatAudio } from '../audio/combat-audio.js';
import type { ProjectileImpactResult } from '../systems/projectile-impact.js';
import {
  combatFeedbackDefinition,
  type CombatFeedbackCue,
} from './combat-feedback.js';

type CueListener = (cue: CombatFeedbackCue) => void;

export class CombatFeedbackRenderer {
  private readonly activeObjects = new Set<Phaser.GameObjects.GameObject>();
  private stopped = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly audio: CombatAudio,
    private readonly onCue: CueListener = () => undefined
  ) {}

  fire(
    x: number,
    y: number,
    rotation: number,
    turret: Phaser.GameObjects.Image
  ) {
    const cue = 'fire';
    const definition = this.present(cue);
    if (!definition) return;
    const graphics = this.graphics();
    const tipX = x + Math.cos(rotation) * 34;
    const tipY = y + Math.sin(rotation) * 34;
    const sideX = Math.cos(rotation + Math.PI / 2) * 7;
    const sideY = Math.sin(rotation + Math.PI / 2) * 7;
    graphics
      .fillStyle(definition.color, 0.92)
      .fillTriangle(
        tipX + Math.cos(rotation) * 22,
        tipY + Math.sin(rotation) * 22,
        tipX + sideX,
        tipY + sideY,
        tipX - sideX,
        tipY - sideY
      );
    this.fade(graphics, definition.durationMs, 1.35);
    if (!prefersReducedMotion()) {
      this.scene.tweens.add({
        targets: turret,
        scaleX: turret.scaleX * 0.9,
        duration: definition.durationMs / 2,
        yoyo: true,
      });
    }
  }

  reloadReady(x: number, y: number) {
    const cue = 'reload-ready';
    const definition = this.present(cue);
    if (!definition) return;
    const graphics = this.graphics();
    graphics
      .lineStyle(3, definition.color, 0.9)
      .strokeCircle(x, y, 26)
      .lineStyle(1, definition.secondaryColor, 0.7)
      .strokeCircle(x, y, 34);
    this.fade(graphics, definition.durationMs, 1.25);
  }

  impact(
    x: number,
    y: number,
    outcome: ProjectileImpactResult['outcome'],
    playerHit: boolean
  ) {
    const cue = outcome;
    const definition = this.present(cue);
    if (!definition) return;
    const graphics = this.graphics();
    if (outcome === 'blocked') {
      graphics
        .lineStyle(4, definition.color, 0.92)
        .strokeCircle(x, y, 18)
        .lineStyle(2, definition.secondaryColor, 0.8)
        .strokeCircle(x, y, 27);
    } else {
      const deflection = outcome === 'ricochet' ? 0.65 : 0;
      for (let index = 0; index < definition.particleCount; index += 1) {
        const angle =
          (Math.PI * 2 * index) / definition.particleCount + deflection;
        const distance = 8 + (index % 3) * 4;
        const endDistance = distance + definition.travelPixels * 0.55;
        graphics
          .lineStyle(
            outcome === 'ricochet' ? 2 : 3,
            index % 2 === 0 ? definition.color : definition.secondaryColor,
            0.92
          )
          .lineBetween(
            x + Math.cos(angle) * distance,
            y + Math.sin(angle) * distance,
            x + Math.cos(angle) * endDistance,
            y + Math.sin(angle) * endDistance
          );
      }
    }
    this.fade(graphics, definition.durationMs, 1.18);
    if (playerHit) this.shake(cue);
  }

  lowHealth(x: number, y: number) {
    const cue = 'low-health';
    const definition = this.present(cue);
    if (!definition) return;
    const graphics = this.graphics();
    graphics
      .lineStyle(7, definition.color, 0.72)
      .strokeCircle(x, y, 46)
      .lineStyle(2, definition.secondaryColor, 0.88)
      .strokeCircle(x, y, 58);
    this.fade(graphics, definition.durationMs, 1.12);
  }

  destroyed(x: number, y: number, playerDestroyed = false) {
    const cue = 'destroyed';
    const definition = this.present(cue);
    if (!definition) return;
    const graphics = this.graphics();
    graphics
      .fillStyle(definition.secondaryColor, 0.65)
      .fillCircle(x, y, 18)
      .lineStyle(6, definition.color, 0.92)
      .strokeCircle(x, y, 24);
    for (let index = 0; index < definition.particleCount; index += 1) {
      const angle = (Math.PI * 2 * index) / definition.particleCount;
      const distance = 30 + (index % 3) * 8;
      graphics
        .fillStyle(
          index % 2 === 0 ? definition.color : definition.secondaryColor,
          0.9
        )
        .fillRect(
          x + Math.cos(angle) * distance - 2,
          y + Math.sin(angle) * distance - 2,
          5,
          5
        );
    }
    this.fade(graphics, definition.durationMs, 1.45);
    if (playerDestroyed) this.shake(cue);
  }

  shutdown() {
    if (this.stopped) return;
    this.stopped = true;
    for (const object of this.activeObjects) object.destroy();
    this.activeObjects.clear();
  }

  private present(cue: CombatFeedbackCue) {
    if (this.stopped) return undefined;
    const definition = combatFeedbackDefinition(cue);
    this.audio.play(cue, definition.volume);
    this.onCue(cue);
    return definition;
  }

  private graphics() {
    const graphics = this.scene.add.graphics().setDepth(2_500);
    this.activeObjects.add(graphics);
    return graphics;
  }

  private fade(
    graphics: Phaser.GameObjects.Graphics,
    duration: number,
    scale: number
  ) {
    this.scene.tweens.add({
      targets: graphics,
      alpha: 0,
      scale,
      duration: prefersReducedMotion() ? Math.min(duration, 120) : duration,
      onComplete: () => {
        this.activeObjects.delete(graphics);
        graphics.destroy();
      },
    });
  }

  private shake(cue: CombatFeedbackCue) {
    if (prefersReducedMotion()) return;
    const definition = combatFeedbackDefinition(cue);
    this.scene.cameras.main.shake(
      Math.min(180, definition.durationMs),
      definition.cameraShake
    );
  }
}

function prefersReducedMotion() {
  return (
    typeof globalThis.matchMedia === 'function' &&
    globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}
