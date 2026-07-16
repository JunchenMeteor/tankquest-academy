import type { AssetBundle } from '../../client/assets/index.js';

export type TankRole = 'scout' | 'medium' | 'heavy';

export interface TankVisualDefinition {
  code: string;
  role: TankRole;
  hull: { width: number; height: number; cornerRadius: number };
  turret: { radius: number; barrelLength: number; barrelWidth: number };
  details: string[];
}

export const PLAYER_BODY_SIZE = { width: 52, height: 34 } as const;
export const ENEMY_BODY_SIZES = {
  scout: { width: 42, height: 28 },
  medium: { width: 48, height: 32 },
  heavy: { width: 56, height: 38 },
} as const;

const TANK_ASSET_ID = 'asset_tank_visuals_v1';
const playerFallbacks: Record<string, TankVisualDefinition> = {
  'star-shield': {
    code: 'star-shield',
    role: 'medium',
    hull: { width: 58, height: 34, cornerRadius: 8 },
    turret: { radius: 15, barrelLength: 35, barrelWidth: 7 },
    details: ['front-star', 'side-panels'],
  },
  'swift-fox': {
    code: 'swift-fox',
    role: 'scout',
    hull: { width: 52, height: 28, cornerRadius: 12 },
    turret: { radius: 12, barrelLength: 31, barrelWidth: 5 },
    details: ['fox-ears', 'rear-vents'],
  },
  'iron-mountain': {
    code: 'iron-mountain',
    role: 'heavy',
    hull: { width: 66, height: 40, cornerRadius: 5 },
    turret: { radius: 18, barrelLength: 40, barrelWidth: 9 },
    details: ['armor-brow', 'track-guards'],
  },
};

const enemyFallbacks: Record<TankRole, TankVisualDefinition> = {
  scout: {
    code: 'enemy-scout',
    role: 'scout',
    hull: { width: 44, height: 26, cornerRadius: 11 },
    turret: { radius: 10, barrelLength: 27, barrelWidth: 5 },
    details: ['fox-ears', 'rear-vents'],
  },
  medium: {
    code: 'enemy-medium',
    role: 'medium',
    hull: { width: 50, height: 32, cornerRadius: 7 },
    turret: { radius: 13, barrelLength: 32, barrelWidth: 7 },
    details: ['front-star', 'side-panels'],
  },
  heavy: {
    code: 'enemy-heavy',
    role: 'heavy',
    hull: { width: 60, height: 38, cornerRadius: 4 },
    turret: { radius: 17, barrelLength: 38, barrelWidth: 9 },
    details: ['armor-brow', 'track-guards'],
  },
};

interface ParsedTankVisuals {
  players: Map<string, TankVisualDefinition>;
  enemyScales: Map<
    TankRole,
    { hullScale: number; turretScale: number; barrelScale: number }
  >;
}

export function resolvePlayerTankVisual(
  code: string,
  bundle?: AssetBundle
): TankVisualDefinition {
  const parsed = parseTankVisuals(bundle);
  return cloneDefinition(
    parsed?.players.get(code) ??
      playerFallbacks[code] ??
      playerFallbacks['star-shield']!
  );
}

export function resolveEnemyTankVisual(
  role: TankRole,
  bundle?: AssetBundle
): TankVisualDefinition {
  const fallback = enemyFallbacks[role];
  const scale = parseTankVisuals(bundle)?.enemyScales.get(role);
  if (!scale) return cloneDefinition(fallback);
  return {
    ...cloneDefinition(fallback),
    hull: {
      ...fallback.hull,
      width: boundedRound(52 * scale.hullScale, 40, 68),
      height: boundedRound(34 * scale.hullScale, 24, 44),
    },
    turret: {
      ...fallback.turret,
      radius: boundedRound(14 * scale.turretScale, 9, 20),
      barrelLength: boundedRound(34 * scale.barrelScale, 24, 44),
    },
  };
}

function parseTankVisuals(bundle?: AssetBundle): ParsedTankVisuals | null {
  const bytes = bundle?.resources.get(TANK_ASSET_ID);
  if (!bytes) return null;
  try {
    const value: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (
      !isRecord(value) ||
      !hasOnlyKeys(value, ['schemaVersion', 'playerTanks', 'enemyRoles']) ||
      value.schemaVersion !== 1
    ) {
      return null;
    }
    if (!Array.isArray(value.playerTanks) || !Array.isArray(value.enemyRoles)) {
      return null;
    }

    const players = new Map<string, TankVisualDefinition>();
    for (const item of value.playerTanks) {
      const definition = parsePlayer(item);
      if (!definition || players.has(definition.code)) return null;
      players.set(definition.code, definition);
    }
    if (
      players.size !== 3 ||
      ![...Object.keys(playerFallbacks)].every((code) => players.has(code))
    ) {
      return null;
    }

    const enemyScales: ParsedTankVisuals['enemyScales'] = new Map();
    for (const item of value.enemyRoles) {
      if (
        !isRecord(item) ||
        !hasOnlyKeys(item, [
          'role',
          'hullScale',
          'turretScale',
          'barrelScale',
        ]) ||
        !isRole(item.role) ||
        enemyScales.has(item.role)
      ) {
        return null;
      }
      const hullScale = numberInRange(item.hullScale, 0.7, 1.2);
      const turretScale = numberInRange(item.turretScale, 0.7, 1.2);
      const barrelScale = numberInRange(item.barrelScale, 0.7, 1.2);
      if (hullScale === null || turretScale === null || barrelScale === null) {
        return null;
      }
      enemyScales.set(item.role, { hullScale, turretScale, barrelScale });
    }
    if (
      enemyScales.size !== 3 ||
      !(['scout', 'medium', 'heavy'] as const).every((role) =>
        enemyScales.has(role)
      )
    ) {
      return null;
    }
    return { players, enemyScales };
  } catch {
    return null;
  }
}

function parsePlayer(value: unknown): TankVisualDefinition | null {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ['code', 'role', 'hull', 'turret', 'details']) ||
    typeof value.code !== 'string' ||
    !isRole(value.role)
  ) {
    return null;
  }
  if (
    !isRecord(value.hull) ||
    !hasOnlyKeys(value.hull, ['width', 'height', 'cornerRadius']) ||
    !isRecord(value.turret) ||
    !hasOnlyKeys(value.turret, ['radius', 'barrelLength', 'barrelWidth'])
  ) {
    return null;
  }
  const width = integerInRange(value.hull.width, 40, 72);
  const height = integerInRange(value.hull.height, 24, 46);
  const cornerRadius = integerInRange(value.hull.cornerRadius, 2, 16);
  const radius = integerInRange(value.turret.radius, 8, 22);
  const barrelLength = integerInRange(value.turret.barrelLength, 22, 48);
  const barrelWidth = integerInRange(value.turret.barrelWidth, 3, 12);
  if (
    [width, height, cornerRadius, radius, barrelLength, barrelWidth].some(
      (item) => item === null
    ) ||
    !Array.isArray(value.details) ||
    value.details.length > 8 ||
    !value.details.every(
      (item) => typeof item === 'string' && /^[a-z0-9-]{1,32}$/.test(item)
    )
  ) {
    return null;
  }
  return {
    code: value.code,
    role: value.role,
    hull: { width: width!, height: height!, cornerRadius: cornerRadius! },
    turret: {
      radius: radius!,
      barrelLength: barrelLength!,
      barrelWidth: barrelWidth!,
    },
    details: [...value.details],
  };
}

function cloneDefinition(value: TankVisualDefinition): TankVisualDefinition {
  return {
    ...value,
    hull: { ...value.hull },
    turret: { ...value.turret },
    details: [...value.details],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, keys: string[]) {
  const allowed = new Set(keys);
  return Object.keys(value).every((key) => allowed.has(key));
}

function isRole(value: unknown): value is TankRole {
  return value === 'scout' || value === 'medium' || value === 'heavy';
}

function integerInRange(value: unknown, minimum: number, maximum: number) {
  return typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= minimum &&
    value <= maximum
    ? value
    : null;
}

function numberInRange(value: unknown, minimum: number, maximum: number) {
  return typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= minimum &&
    value <= maximum
    ? value
    : null;
}

function boundedRound(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, Math.round(value)));
}
