import type Phaser from 'phaser';

import type { RuntimeLevelConfig } from '../runtime/types.js';

export interface ThemeAtmosphereDefinition {
  kind: 'scanner' | 'leaves' | 'snow';
  color: number;
  count: number;
  alpha: number;
  durationMs: number;
}

const definitions: Record<
  RuntimeLevelConfig['theme'],
  ThemeAtmosphereDefinition
> = {
  'training-base': {
    kind: 'scanner',
    color: 0xe8c65a,
    count: 3,
    alpha: 0.16,
    durationMs: 4200,
  },
  'forest-camp': {
    kind: 'leaves',
    color: 0xa6bd75,
    count: 12,
    alpha: 0.32,
    durationMs: 6800,
  },
  'snow-field': {
    kind: 'snow',
    color: 0xf4fbff,
    count: 16,
    alpha: 0.52,
    durationMs: 5600,
  },
};

export function themeAtmosphereDefinition(theme: RuntimeLevelConfig['theme']) {
  return definitions[theme];
}

export class ThemeAtmosphere {
  private readonly objects: Phaser.GameObjects.GameObject[] = [];
  private readonly tweens: Phaser.Tweens.Tween[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    theme: RuntimeLevelConfig['theme'],
    width: number,
    height: number
  ) {
    const definition = themeAtmosphereDefinition(theme);
    if (definition.kind === 'scanner') {
      this.createScanner(definition, width, height);
    } else {
      this.createDrift(definition, width, height);
    }
  }

  shutdown() {
    for (const tween of this.tweens) tween.stop();
    for (const object of this.objects) object.destroy();
    this.tweens.length = 0;
    this.objects.length = 0;
  }

  private createScanner(
    definition: ThemeAtmosphereDefinition,
    width: number,
    height: number
  ) {
    for (let index = 0; index < definition.count; index += 1) {
      const line = this.scene.add
        .rectangle(
          width / 2,
          70 + index * (height / definition.count),
          width * 0.82,
          2,
          definition.color,
          definition.alpha
        )
        .setDepth(-8);
      this.objects.push(line);
      this.addTween(line, {
        x: width * 0.58,
        yoyo: true,
        repeat: -1,
        duration: definition.durationMs + index * 420,
      });
    }
  }

  private createDrift(
    definition: ThemeAtmosphereDefinition,
    width: number,
    height: number
  ) {
    for (let index = 0; index < definition.count; index += 1) {
      const radius = definition.kind === 'snow' ? 2 + (index % 3) : 3;
      const particle = this.scene.add
        .ellipse(
          ((index * 83 + 47) % Math.max(1, width - 40)) + 20,
          ((index * 53 + 29) % Math.max(1, height - 40)) + 20,
          radius * 2.4,
          radius,
          definition.color,
          definition.alpha
        )
        .setDepth(-7)
        .setRotation((index % 5) * 0.28);
      this.objects.push(particle);
      this.addTween(particle, {
        x: particle.x + (definition.kind === 'snow' ? 42 : 70),
        y: particle.y + (definition.kind === 'snow' ? 95 : 55),
        alpha: definition.alpha * 0.45,
        yoyo: true,
        repeat: -1,
        duration: definition.durationMs + index * 110,
      });
    }
  }

  private addTween(
    target: Phaser.GameObjects.GameObject,
    config: Omit<Phaser.Types.Tweens.TweenBuilderConfig, 'targets'>
  ) {
    if (prefersReducedMotion()) return;
    this.tweens.push(this.scene.tweens.add({ targets: target, ...config }));
  }
}

function prefersReducedMotion() {
  return (
    typeof globalThis.matchMedia === 'function' &&
    globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}
