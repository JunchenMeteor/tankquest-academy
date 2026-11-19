import {
  DataTexture,
  LinearFilter,
  MeshStandardMaterial,
  RGBAFormat,
  RepeatWrapping,
  SRGBColorSpace,
} from 'three';
import type { RuntimeLevelConfig } from '../runtime/types.js';
import type { ScenePalette } from '../presentation/map-visual-definition.js';

export type BattleSurfaceKind = 'ground' | 'cover';

function hash(x: number, y: number, seed: number): number {
  let value = Math.imul(x + seed, 374761393) + Math.imul(y - seed, 668265263);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
}

export function battleSurfacePixels(
  theme: RuntimeLevelConfig['theme'],
  baseColor: number,
  kind: BattleSurfaceKind,
  size = 128
): Uint8Array {
  const pixels = new Uint8Array(size * size * 4);
  const seed = theme === 'forest-camp' ? 37 : theme === 'snow-field' ? 71 : 19;
  const red = (baseColor >> 16) & 0xff;
  const green = (baseColor >> 8) & 0xff;
  const blue = baseColor & 0xff;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const broad = hash(Math.floor(x / 12), Math.floor(y / 12), seed) - 0.5;
      const fine = hash(x, y, seed + 11) - 0.5;
      let factor = 0.94 + broad * 0.16 + fine * 0.1;
      if (kind === 'ground') {
        const lane = x % 64;
        if (theme !== 'snow-field' && (lane < 5 || (lane > 27 && lane < 32))) {
          factor *= y % 11 < 2 ? 0.72 : 0.84;
        }
        if (theme === 'snow-field' && hash(x, y, seed + 29) > 0.965) {
          factor = 1.12;
        }
      } else {
        if (x % 32 < 2 || y % 32 < 2) factor *= 0.68;
        if (x % 32 === 5 && y % 32 === 5) factor *= 0.48;
      }
      const offset = (y * size + x) * 4;
      pixels[offset] = Math.min(255, red * factor);
      pixels[offset + 1] = Math.min(255, green * factor);
      pixels[offset + 2] = Math.min(255, blue * factor);
      pixels[offset + 3] = 255;
    }
  }
  return pixels;
}

function surfaceTexture(
  theme: RuntimeLevelConfig['theme'],
  color: number,
  kind: BattleSurfaceKind,
  repeat: number
): DataTexture {
  const size = 128;
  const texture = new DataTexture(
    battleSurfacePixels(theme, color, kind, size),
    size,
    size,
    RGBAFormat
  );
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.repeat.set(repeat, repeat);
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

export function createBattleMapMaterials(
  theme: RuntimeLevelConfig['theme'],
  palette: ScenePalette
) {
  const groundMap = surfaceTexture(theme, palette.floor.base, 'ground', 10);
  const obstacleMap = surfaceTexture(theme, palette.obstacle.top, 'cover', 2);
  return {
    floor: new MeshStandardMaterial({ map: groundMap, roughness: 0.95 }),
    obstacle: new MeshStandardMaterial({ map: obstacleMap, roughness: 0.85 }),
    dispose() {
      for (const texture of [groundMap, obstacleMap]) texture.dispose();
      this.floor.dispose();
      this.obstacle.dispose();
    },
  };
}

export type BattleMapMaterials = ReturnType<typeof createBattleMapMaterials>;
