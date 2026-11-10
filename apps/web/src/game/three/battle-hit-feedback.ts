import { CanvasTexture, SRGBColorSpace, Sprite, SpriteMaterial } from 'three';
import type { Scene } from 'three';
import type { ArmorZone } from '../runtime/types.js';
import type { ShellImpact } from './battle-combat.js';

export interface HitFeedbackText {
  text: string;
  color: string;
}

const zoneNames: Record<'en' | 'zh-CN', Record<ArmorZone, string>> = {
  en: { front: 'Front', side: 'Side', rear: 'Rear' },
  'zh-CN': { front: '正面', side: '侧面', rear: '背面' },
};

export function shellImpactText(
  impact: Pick<ShellImpact, 'damage' | 'zone' | 'outcome'>,
  locale: 'en' | 'zh-CN'
): HitFeedbackText {
  const zone = zoneNames[locale][impact.zone];
  if (impact.outcome === 'ammo-explosion') {
    return {
      text:
        locale === 'zh-CN'
          ? `${zone}命中 · 弹药架殉爆`
          : `${zone} hit · ammo-rack explosion`,
      color: '#ff6d4a',
    };
  }
  if (impact.outcome === 'critical') {
    return {
      text:
        locale === 'zh-CN'
          ? `${zone}致命一击 · 弹药架受损`
          : `${zone} critical · ammo rack damaged`,
      color: '#ffd166',
    };
  }
  if (impact.outcome === 'ricochet') {
    return {
      text: locale === 'zh-CN' ? `${zone}跳弹` : `${zone} ricochet`,
      color: '#9ee7ff',
    };
  }
  if (impact.outcome === 'blocked') {
    return {
      text: locale === 'zh-CN' ? `${zone}未击穿` : `${zone} armour held`,
      color: '#ffe08a',
    };
  }
  return {
    text:
      locale === 'zh-CN'
        ? `${zone}击穿 · -${impact.damage}`
        : `${zone} penetrated · -${impact.damage}`,
    color: '#ff9a7a',
  };
}

export function ramImpactText(
  damage: number,
  locale: 'en' | 'zh-CN'
): HitFeedbackText {
  return {
    text:
      locale === 'zh-CN' ? `撞击伤害 · -${damage}` : `Ram damage · -${damage}`,
    color: '#ffc36a',
  };
}

interface ActiveLabel {
  sprite: Sprite;
  material: SpriteMaterial;
  texture: CanvasTexture;
  ttl: number;
}

export class BattleHitFeedback {
  private readonly labels: ActiveLabel[] = [];

  constructor(private readonly scene: Scene) {}

  spawn(impact: ShellImpact, locale: 'en' | 'zh-CN'): void {
    this.spawnText(shellImpactText(impact, locale), impact.point);
  }

  spawnRam(
    point: { x: number; y: number; z: number },
    damage: number,
    locale: 'en' | 'zh-CN'
  ): void {
    if (damage <= 0) return;
    this.spawnText(ramImpactText(damage, locale), point);
  }

  update(delta: number): void {
    for (let index = this.labels.length - 1; index >= 0; index -= 1) {
      const label = this.labels[index]!;
      label.ttl -= delta;
      if (label.ttl <= 0) {
        this.release(label);
        this.labels.splice(index, 1);
        continue;
      }
      label.sprite.position.y += delta * 0.45;
      label.material.opacity = Math.min(1, label.ttl / 0.35);
    }
  }

  dispose(): void {
    for (const label of this.labels) this.release(label);
    this.labels.length = 0;
  }

  private spawnText(
    feedback: HitFeedbackText,
    point: { x: number; y: number; z: number }
  ): void {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Hit feedback requires a 2D canvas');
    context.fillStyle = 'rgba(10, 17, 22, 0.78)';
    context.fillRect(0, 12, canvas.width, 104);
    context.font = '600 36px system-ui, sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillStyle = feedback.color;
    context.fillText(feedback.text, 256, 64, 480);
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    const material = new SpriteMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
    });
    const sprite = new Sprite(material);
    sprite.name = 'HitFeedback';
    sprite.userData.feedback = feedback.text;
    sprite.raycast = () => {};
    sprite.position.set(point.x, point.y + 0.65, point.z);
    sprite.scale.set(3.4, 0.85, 1);
    sprite.center.set(0.5, 0);
    sprite.renderOrder = 11;
    this.scene.add(sprite);
    this.labels.push({ sprite, material, texture, ttl: 1.05 });
  }

  private release(label: ActiveLabel): void {
    this.scene.remove(label.sprite);
    label.texture.dispose();
    label.material.dispose();
  }
}
