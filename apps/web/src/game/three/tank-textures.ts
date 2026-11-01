import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three';

export interface TankTextures {
  map: CanvasTexture;
  roughnessMap: CanvasTexture;
}

/**
 * Paints the tank surface at runtime: panel seams, weld lines, rivets, rust
 * streaks and scuffs. Generating it here keeps the byte budget at zero and
 * gives the flat materials something to catch the light with.
 */
export function createTankTextures(size = 512): TankTextures {
  const color = document.createElement('canvas');
  color.width = size;
  color.height = size;
  const ctx = color.getContext('2d');
  const rough = document.createElement('canvas');
  rough.width = size;
  rough.height = size;
  const rctx = rough.getContext('2d');

  if (!ctx || !rctx) {
    const blank = new CanvasTexture(color);
    return { map: blank, roughnessMap: blank };
  }

  /* Base steel with a mottled finish. */
  ctx.fillStyle = '#b8bcc0';
  ctx.fillRect(0, 0, size, size);
  for (let index = 0; index < 2600; index += 1) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const shade = 150 + Math.random() * 90;
    ctx.fillStyle = `rgba(${shade},${shade + 4},${shade + 8},0.18)`;
    ctx.fillRect(x, y, 1 + Math.random() * 3, 1 + Math.random() * 3);
  }

  /* Panel grid and weld beads. */
  ctx.strokeStyle = 'rgba(60, 66, 70, 0.55)';
  ctx.lineWidth = 2;
  for (const y of [96, 208, 320, 432]) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size, y);
    ctx.stroke();
  }
  for (const x of [128, 300, 430]) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, size);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(120, 128, 132, 0.5)';
  ctx.lineWidth = 1;
  for (let index = 0; index < 4; index += 1) {
    const y = 96 + index * 112;
    for (let x = 6; x < size; x += 12) {
      ctx.beginPath();
      ctx.moveTo(x, y - 3);
      ctx.lineTo(x + 6, y + 3);
      ctx.stroke();
    }
  }

  /* Rivets along the seams. */
  for (let y = 100; y < size; y += 112) {
    for (let x = 10; x < size; x += 18) {
      ctx.beginPath();
      ctx.fillStyle = 'rgba(90, 96, 100, 0.85)';
      ctx.arc(x, y + 6, 1.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(220, 226, 230, 0.35)';
      ctx.beginPath();
      ctx.arc(x - 0.6, y + 5.2, 0.9, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /* Rust streaks running down from the seams. */
  for (let index = 0; index < 26; index += 1) {
    const x = Math.random() * size;
    const y = 96 + Math.floor(Math.random() * 4) * 112;
    const length = 20 + Math.random() * 70;
    const gradient = ctx.createLinearGradient(x, y, x, y + length);
    gradient.addColorStop(0, 'rgba(126, 74, 38, 0.5)');
    gradient.addColorStop(1, 'rgba(126, 74, 38, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, 1 + Math.random() * 3, length);
  }

  /* Scuffs and chipped paint. */
  for (let index = 0; index < 90; index += 1) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const length = 4 + Math.random() * 22;
    const angle = Math.random() * Math.PI;
    ctx.strokeStyle = `rgba(58, 62, 64, ${0.16 + Math.random() * 0.3})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
    ctx.stroke();
  }

  /* Roughness follows the paint: worn patches are shinier. */
  rctx.fillStyle = '#c8c8c8';
  rctx.fillRect(0, 0, size, size);
  for (let index = 0; index < 1400; index += 1) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const value = 90 + Math.random() * 140;
    rctx.fillStyle = `rgba(${value},${value},${value},0.35)`;
    rctx.fillRect(x, y, 2 + Math.random() * 5, 2 + Math.random() * 5);
  }
  for (let y = 96; y < size; y += 112) {
    rctx.fillStyle = 'rgba(70, 70, 70, 0.6)';
    rctx.fillRect(0, y - 1, size, 3);
  }

  const map = new CanvasTexture(color);
  map.colorSpace = SRGBColorSpace;
  map.wrapS = RepeatWrapping;
  map.wrapT = RepeatWrapping;
  map.repeat.set(2, 2);
  map.anisotropy = 4;

  const roughnessMap = new CanvasTexture(rough);
  roughnessMap.wrapS = RepeatWrapping;
  roughnessMap.wrapT = RepeatWrapping;
  roughnessMap.repeat.set(2, 2);

  return { map, roughnessMap };
}
