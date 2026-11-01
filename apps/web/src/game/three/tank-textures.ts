import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three';

export interface TankTextures {
  map: CanvasTexture;
  roughnessMap: CanvasTexture;
  normalMap: CanvasTexture;
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
  const height = document.createElement('canvas');
  height.width = size;
  height.height = size;
  const hctx = height.getContext('2d');

  if (!ctx || !rctx || !hctx) {
    const blank = new CanvasTexture(color);
    return { map: blank, roughnessMap: blank, normalMap: blank };
  }

  /* The height field the normal map is derived from. */
  hctx.fillStyle = '#808080';
  hctx.fillRect(0, 0, size, size);

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
  for (const y of [128, 384]) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size, y);
    ctx.stroke();
    hctx.strokeStyle = 'rgba(40, 40, 40, 0.9)';
    hctx.lineWidth = 3;
    hctx.beginPath();
    hctx.moveTo(0, y);
    hctx.lineTo(size, y);
    hctx.stroke();
  }
  for (const x of [260]) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, size);
    ctx.stroke();
    hctx.strokeStyle = 'rgba(48, 48, 48, 0.85)';
    hctx.lineWidth = 3;
    hctx.beginPath();
    hctx.moveTo(x, 0);
    hctx.lineTo(x, size);
    hctx.stroke();
  }
  ctx.strokeStyle = 'rgba(120, 128, 132, 0.5)';
  ctx.lineWidth = 1;
  for (let index = 0; index < 4; index += 1) {
    const y = 96 + index * 112;
    for (let x = 10; x < size; x += 26) {
      ctx.beginPath();
      ctx.moveTo(x, y - 3);
      ctx.lineTo(x + 6, y + 3);
      ctx.stroke();
    }
  }

  /* Rivets along the seams. */
  for (let y = 100; y < size; y += 112) {
    for (let x = 14; x < size; x += 34) {
      ctx.beginPath();
      ctx.fillStyle = 'rgba(90, 96, 100, 0.85)';
      ctx.arc(x, y + 6, 1.8, 0, Math.PI * 2);
      ctx.fill();
      const bump = hctx.createRadialGradient(x, y + 6, 0, x, y + 6, 3.4);
      bump.addColorStop(0, 'rgba(228, 228, 228, 0.95)');
      bump.addColorStop(1, 'rgba(128, 128, 128, 0)');
      hctx.fillStyle = bump;
      hctx.beginPath();
      hctx.arc(x, y + 6, 3.4, 0, Math.PI * 2);
      hctx.fill();
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
  map.repeat.set(1, 1);
  map.anisotropy = 4;

  /* Sobel the height field into a tangent-space normal map. */
  const normalCanvas = document.createElement('canvas');
  normalCanvas.width = size;
  normalCanvas.height = size;
  const nctx = normalCanvas.getContext('2d');
  if (nctx) {
    const source = hctx.getImageData(0, 0, size, size).data;
    const out = nctx.createImageData(size, size);
    const at = (x: number, y: number) =>
      source[(((y + size) % size) * size + ((x + size) % size)) << 2] ?? 128;
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const dx =
          (at(x + 1, y - 1) +
            2 * at(x + 1, y) +
            at(x + 1, y + 1) -
            at(x - 1, y - 1) -
            2 * at(x - 1, y) -
            at(x - 1, y + 1)) /
          1024;
        const dy =
          (at(x - 1, y + 1) +
            2 * at(x, y + 1) +
            at(x + 1, y + 1) -
            at(x - 1, y - 1) -
            2 * at(x, y - 1) -
            at(x + 1, y - 1)) /
          1024;
        const length = Math.hypot(dx, dy, 1);
        const offset = (y * size + x) << 2;
        out.data[offset] = ((-dx / length) * 0.5 + 0.5) * 255;
        out.data[offset + 1] = ((-dy / length) * 0.5 + 0.5) * 255;
        out.data[offset + 2] = ((1 / length) * 0.5 + 0.5) * 255;
        out.data[offset + 3] = 255;
      }
    }
    nctx.putImageData(out, 0, 0);
  }
  const normalMap = new CanvasTexture(normalCanvas);
  normalMap.wrapS = RepeatWrapping;
  normalMap.wrapT = RepeatWrapping;
  normalMap.repeat.set(1, 1);

  const roughnessMap = new CanvasTexture(rough);
  roughnessMap.wrapS = RepeatWrapping;
  roughnessMap.wrapT = RepeatWrapping;
  roughnessMap.repeat.set(1, 1);

  return { map, roughnessMap, normalMap };
}
