import { describe, expect, it } from 'vitest';

import {
  COMBAT_FEEDBACK_LIMITS,
  combatFeedbackCues,
  combatFeedbackDefinition,
  crossedLowHealthThreshold,
  LOW_HEALTH_RATIO,
} from './combat-feedback.js';

describe('combat feedback definitions', () => {
  it('gives every cue a distinct shape and motion within the presentation budget', () => {
    const feedback = combatFeedbackCues.map(combatFeedbackDefinition);

    expect(new Set(feedback.map(({ shape }) => shape)).size).toBe(
      combatFeedbackCues.length
    );
    expect(new Set(feedback.map(({ motion }) => motion)).size).toBe(
      combatFeedbackCues.length
    );

    for (const definition of feedback) {
      expect(definition.color).toBeGreaterThanOrEqual(0);
      expect(definition.color).toBeLessThanOrEqual(0xffffff);
      expect(definition.secondaryColor).toBeGreaterThanOrEqual(0);
      expect(definition.secondaryColor).toBeLessThanOrEqual(0xffffff);
      expect(definition.durationMs).toBeGreaterThanOrEqual(
        COMBAT_FEEDBACK_LIMITS.durationMs.min
      );
      expect(definition.durationMs).toBeLessThanOrEqual(
        COMBAT_FEEDBACK_LIMITS.durationMs.max
      );
      expect(definition.particleCount).toBeGreaterThanOrEqual(
        COMBAT_FEEDBACK_LIMITS.particleCount.min
      );
      expect(definition.particleCount).toBeLessThanOrEqual(
        COMBAT_FEEDBACK_LIMITS.particleCount.max
      );
      expect(definition.travelPixels).toBeGreaterThanOrEqual(
        COMBAT_FEEDBACK_LIMITS.travelPixels.min
      );
      expect(definition.travelPixels).toBeLessThanOrEqual(
        COMBAT_FEEDBACK_LIMITS.travelPixels.max
      );
      expect(definition.cameraShake).toBeGreaterThanOrEqual(
        COMBAT_FEEDBACK_LIMITS.cameraShake.min
      );
      expect(definition.cameraShake).toBeLessThanOrEqual(
        COMBAT_FEEDBACK_LIMITS.cameraShake.max
      );
      expect(definition.volume).toBeGreaterThanOrEqual(
        COMBAT_FEEDBACK_LIMITS.volume.min
      );
      expect(definition.volume).toBeLessThanOrEqual(
        COMBAT_FEEDBACK_LIMITS.volume.max
      );
    }
  });

  it('only reports a live tank crossing into the low-health band', () => {
    expect(LOW_HEALTH_RATIO).toBe(0.35);
    expect(crossedLowHealthThreshold(100, 35, 100)).toBe(true);
    expect(crossedLowHealthThreshold(35, 20, 100)).toBe(false);
    expect(crossedLowHealthThreshold(100, 36, 100)).toBe(false);
    expect(crossedLowHealthThreshold(100, 0, 100)).toBe(false);
    expect(crossedLowHealthThreshold(100, 20, 0)).toBe(false);
    expect(crossedLowHealthThreshold(Number.NaN, 20, 100)).toBe(false);
  });
});
