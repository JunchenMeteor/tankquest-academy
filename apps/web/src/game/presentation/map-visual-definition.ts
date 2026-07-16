import type { AssetBundle } from '../../client/assets/index.js';
import type { RuntimeLevelConfig } from '../runtime/types.js';

export interface ScenePalette {
  floor: { base: number; grid: number; accent: number };
  boundary: { top: number; side: number };
  obstacle: { top: number; side: number };
  shadow: { color: number; alpha: number };
}

const SCENE_ASSET_ID = 'asset_training_grounds_v1';
const fallbackPalettes: Record<RuntimeLevelConfig['theme'], ScenePalette> = {
  'training-base': {
    floor: { base: 0x78845d, grid: 0x9aa978, accent: 0xd5c477 },
    boundary: { top: 0xc0b17b, side: 0x706345 },
    obstacle: { top: 0x9b8b64, side: 0x5e523e },
    shadow: { color: 0x273225, alpha: 0.4 },
  },
  'forest-camp': {
    floor: { base: 0x42634a, grid: 0x628160, accent: 0xa6bd75 },
    boundary: { top: 0x7f9669, side: 0x40523b },
    obstacle: { top: 0x71805c, side: 0x3d4936 },
    shadow: { color: 0x172a1c, alpha: 0.44 },
  },
  'snow-field': {
    floor: { base: 0xc7dce4, grid: 0xedf6f8, accent: 0x83b4c9 },
    boundary: { top: 0xe8f4f6, side: 0x789aa8 },
    obstacle: { top: 0xd8e8ec, side: 0x708b96 },
    shadow: { color: 0x496b7b, alpha: 0.33 },
  },
};

export function resolveScenePalette(
  theme: RuntimeLevelConfig['theme'],
  bundle?: AssetBundle
): ScenePalette {
  const parsed = parseScenePalettes(bundle)?.get(theme);
  return clonePalette(parsed ?? fallbackPalettes[theme]);
}

function parseScenePalettes(bundle?: AssetBundle) {
  const bytes = bundle?.resources.get(SCENE_ASSET_ID);
  if (!bytes) return null;
  try {
    const value: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (
      !isRecord(value) ||
      !hasOnlyKeys(value, ['schemaVersion', 'coordinateSystem', 'themes']) ||
      value.schemaVersion !== 1 ||
      value.coordinateSystem !== 'world-2d' ||
      !Array.isArray(value.themes)
    ) {
      return null;
    }
    const palettes = new Map<RuntimeLevelConfig['theme'], ScenePalette>();
    for (const item of value.themes) {
      const parsed = parseTheme(item);
      if (!parsed || palettes.has(parsed.id)) return null;
      palettes.set(parsed.id, parsed.palette);
    }
    return palettes.size === 3 &&
      (['training-base', 'forest-camp', 'snow-field'] as const).every((theme) =>
        palettes.has(theme)
      )
      ? palettes
      : null;
  } catch {
    return null;
  }
}

function parseTheme(value: unknown): {
  id: RuntimeLevelConfig['theme'];
  palette: ScenePalette;
} | null {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ['id', 'floor', 'boundary', 'obstacle', 'shadow']) ||
    !isTheme(value.id) ||
    !isRecord(value.floor) ||
    !hasOnlyKeys(value.floor, ['base', 'grid', 'accent']) ||
    !isRecord(value.boundary) ||
    !hasOnlyKeys(value.boundary, ['top', 'side']) ||
    !isRecord(value.obstacle) ||
    !hasOnlyKeys(value.obstacle, ['top', 'side'])
  ) {
    return null;
  }
  const base = parseHexColor(value.floor.base);
  const grid = parseHexColor(value.floor.grid);
  const accent = parseHexColor(value.floor.accent);
  const boundaryTop = parseHexColor(value.boundary.top);
  const boundarySide = parseHexColor(value.boundary.side);
  const obstacleTop = parseHexColor(value.obstacle.top);
  const obstacleSide = parseHexColor(value.obstacle.side);
  const shadow = parseHexColor(value.shadow, true);
  if (
    !base ||
    !grid ||
    !accent ||
    !boundaryTop ||
    !boundarySide ||
    !obstacleTop ||
    !obstacleSide ||
    !shadow
  ) {
    return null;
  }
  return {
    id: value.id,
    palette: {
      floor: { base: base.color, grid: grid.color, accent: accent.color },
      boundary: { top: boundaryTop.color, side: boundarySide.color },
      obstacle: { top: obstacleTop.color, side: obstacleSide.color },
      shadow,
    },
  };
}

function parseHexColor(value: unknown, alphaRequired = false) {
  if (
    typeof value !== 'string' ||
    !(alphaRequired ? /^#[0-9a-f]{8}$/i : /^#[0-9a-f]{6}$/i).test(value)
  ) {
    return null;
  }
  return {
    color: Number.parseInt(value.slice(1, 7), 16),
    alpha: value.length === 9 ? Number.parseInt(value.slice(7), 16) / 255 : 1,
  };
}

function clonePalette(value: ScenePalette): ScenePalette {
  return {
    floor: { ...value.floor },
    boundary: { ...value.boundary },
    obstacle: { ...value.obstacle },
    shadow: { ...value.shadow },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, keys: string[]) {
  const allowed = new Set(keys);
  return Object.keys(value).every((key) => allowed.has(key));
}

function isTheme(value: unknown): value is RuntimeLevelConfig['theme'] {
  return (
    value === 'training-base' ||
    value === 'forest-camp' ||
    value === 'snow-field'
  );
}
