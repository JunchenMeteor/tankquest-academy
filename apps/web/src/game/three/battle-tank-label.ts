import { CanvasTexture, SRGBColorSpace, Sprite, SpriteMaterial } from 'three';

export interface TankLabel {
  sprite: Sprite;
  update: (health: number, maxHealth: number) => void;
  dispose: () => void;
}

export function createTankLabel(
  name: string,
  health: number,
  maxHealth: number,
  team: 'player' | 'enemy'
): TankLabel {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Tank labels require a 2D canvas');
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  const material = new SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
  });
  const sprite = new Sprite(material);
  sprite.name = 'TankLabel';
  sprite.raycast = () => {};
  sprite.position.set(0, 3.6, 0);
  sprite.scale.set(4.5, 1.125, 1);
  sprite.center.set(0.5, 0);
  sprite.renderOrder = 10;
  let current = '';

  const update = (nextHealth: number, nextMaxHealth: number) => {
    const maximum = Math.max(1, Math.round(nextMaxHealth));
    const remaining = Math.max(0, Math.min(maximum, Math.round(nextHealth)));
    const key = `${remaining}/${maximum}`;
    if (key === current) return;
    current = key;
    const ratio = remaining / maximum;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = 'rgba(10, 17, 22, 0.86)';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.font = '600 31px system-ui, sans-serif';
    context.textBaseline = 'top';
    context.fillStyle = '#f4f8fb';
    context.fillText(name, 20, 13, 310);
    context.font = '500 25px system-ui, sans-serif';
    context.textAlign = 'right';
    context.fillText(`${remaining} / ${maximum}`, 492, 17);
    context.textAlign = 'left';
    context.fillStyle = 'rgba(255, 255, 255, 0.16)';
    context.fillRect(20, 67, 472, 36);
    context.fillStyle = team === 'player' ? '#55c8ff' : '#ff846c';
    context.fillRect(20, 67, 472 * ratio, 36);
    context.strokeStyle = 'rgba(255, 255, 255, 0.65)';
    context.lineWidth = 2;
    context.strokeRect(20, 67, 472, 36);
    texture.needsUpdate = true;
  };

  update(health, maxHealth);
  return {
    sprite,
    update,
    dispose() {
      texture.dispose();
      material.dispose();
    },
  };
}
