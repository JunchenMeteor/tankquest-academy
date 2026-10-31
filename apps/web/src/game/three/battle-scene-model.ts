/**
 * Pure geometry for the 3D battle view.
 * Keeps the Three.js layer thin and lets the mapping be unit tested without WebGL.
 */
import type { RuntimeLevelConfig } from '../runtime/types.js';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface TankPlacement {
  id: string;
  role: 'scout' | 'medium' | 'heavy';
  elite: boolean;
  position: Vec3;
  heading: number;
  hull: [number, number, number];
  turretRadius: number;
  barrelLength: number;
  color: number;
}

export interface BlockPlacement {
  position: Vec3;
  size: [number, number, number];
}

export interface SceneLayout {
  ground: { width: number; depth: number };
  player: TankPlacement;
  enemies: TankPlacement[];
  blocks: BlockPlacement[];
}

const ROLE_SHAPES = {
  scout: {
    hull: [3, 0.85, 1.8],
    turretRadius: 0.8,
    barrelLength: 2,
    color: 0x8f5745,
  },
  medium: {
    hull: [3.4, 1, 2],
    turretRadius: 0.95,
    barrelLength: 2.4,
    color: 0x9a6148,
  },
  heavy: {
    hull: [3.9, 1.15, 2.3],
    turretRadius: 1.1,
    barrelLength: 2.8,
    color: 0x7d6349,
  },
} as const;

const PLAYER_HULL: [number, number, number] = [3.6, 1.05, 2.1];

/** Converts field coordinates (top-down, y down) into world coordinates (y up). */
export function toWorld(x: number, y: number, height = 0): Vec3 {
  return { x: x / 40, y: height, z: y / 40 };
}

export function buildSceneLayout(config: RuntimeLevelConfig): SceneLayout {
  const elevation = (x: number, z: number) =>
    Math.sin(x * 0.25) * 0.12 + Math.cos(z * 0.21) * 0.1;

  const spawn = toWorld(
    config.playerSpawn.x,
    config.playerSpawn.y,
    elevation(config.playerSpawn.x / 40, config.playerSpawn.y / 40)
  );

  const nearest = config.enemies[0];
  const heading = nearest
    ? Math.atan2(-(toWorld(nearest.x, nearest.y).z - spawn.z), toWorld(nearest.x, nearest.y).x - spawn.x)
    : -Math.PI / 2;

  const player: TankPlacement = {
    id: 'player',
    role: 'medium',
    elite: false,
    position: spawn,
    heading,
    hull: PLAYER_HULL,
    turretRadius: 1,
    barrelLength: 2.6,
    color: 0x6d8798,
  };

  const enemies = config.enemies.map((enemy) => {
    const shape = ROLE_SHAPES[enemy.role];
    const position = toWorld(
      enemy.x,
      enemy.y,
      elevation(enemy.x / 40, enemy.y / 40)
    );
    return {
      id: enemy.id,
      role: enemy.role,
      elite: Boolean(enemy.elite),
      position,
      heading: Math.PI / 2,
      hull: [...shape.hull] as [number, number, number],
      turretRadius: shape.turretRadius,
      barrelLength: shape.barrelLength,
      color: enemy.elite ? 0xf2c14e : shape.color,
    };
  });

  const blocks = config.obstacles.map((obstacle) => ({
    position: toWorld(obstacle.x, obstacle.y, 0.55),
    size: [
      Math.max(1, obstacle.width / 40),
      1.1,
      Math.max(1, obstacle.height / 40),
    ] as [number, number, number],
  }));

  return {
    ground: { width: config.width / 40, depth: config.height / 40 },
    player,
    enemies,
    blocks,
  };
}

export type CameraMode = 'first' | 'third';

export interface CameraPose {
  position: Vec3;
  target: Vec3;
}

/**
 * Chase camera sits behind and above the tank; the first-person camera sits on
 * the turret roof and looks along the hull heading.
 */
export function cameraPose(
  mode: CameraMode,
  player: Pick<TankPlacement, 'position' | 'heading'>,
  lookOffset = 0
): CameraPose {
  const heading = player.heading + lookOffset;
  if (mode === 'first') {
    return {
      position: { x: player.position.x, y: 2.75, z: player.position.z },
      target: {
        x: player.position.x + Math.cos(heading) * 20,
        y: 1.6,
        z: player.position.z - Math.sin(heading) * 20,
      },
    };
  }
  return {
    position: {
      x: player.position.x - Math.cos(heading) * 11,
      y: 6.8,
      z: player.position.z + Math.sin(heading) * 11,
    },
    target: {
      x: player.position.x + Math.cos(heading) * 7,
      y: 1.4,
      z: player.position.z - Math.sin(heading) * 7,
    },
  };
}

/** Applies a movement step to a tank position, clamped to the field. */
export function stepTank(
  player: Pick<TankPlacement, 'position' | 'heading'>,
  input: { forward: number; turn: number },
  deltaSeconds: number,
  layout: SceneLayout
): { position: Vec3; heading: number } {
  const heading = player.heading + input.turn * 1.6 * deltaSeconds;
  const speed = 6 * deltaSeconds * input.forward;
  const halfWidth = layout.ground.width / 2;
  const halfDepth = layout.ground.depth / 2;
  return {
    heading,
    position: {
      x: Math.max(
        -halfWidth,
        Math.min(halfWidth, player.position.x + Math.cos(heading) * speed)
      ),
      y: player.position.y,
      z: Math.max(
        -halfDepth,
        Math.min(halfDepth, player.position.z - Math.sin(heading) * speed)
      ),
    },
  };
}
