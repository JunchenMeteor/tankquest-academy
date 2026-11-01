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
  playfield: { width: number; depth: number };
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

/**
 * Field pixels per world unit. Smaller values stretch the battlefield, so the
 * field spans more tank lengths without shrinking the tanks themselves.
 */
export const FIELD_SCALE = 14;

/** Converts field coordinates (top-down, y down) into world coordinates (y up). */
export function toWorld(x: number, y: number, height = 0): Vec3 {
  return { x: x / FIELD_SCALE, y: height, z: y / FIELD_SCALE };
}

export function buildSceneLayout(config: RuntimeLevelConfig): SceneLayout {
  const elevation = (x: number, z: number) =>
    Math.sin(x * 0.25) * 0.12 + Math.cos(z * 0.21) * 0.1;

  const spawn = toWorld(
    config.playerSpawn.x,
    config.playerSpawn.y,
    elevation(
      config.playerSpawn.x / FIELD_SCALE,
      config.playerSpawn.y / FIELD_SCALE
    )
  );

  const nearest = config.enemies[0];
  const heading = nearest
    ? Math.atan2(
        -(toWorld(nearest.x, nearest.y).z - spawn.z),
        toWorld(nearest.x, nearest.y).x - spawn.x
      )
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
      Math.max(1, obstacle.width / FIELD_SCALE),
      1.1,
      Math.max(1, obstacle.height / FIELD_SCALE),
    ] as [number, number, number],
  }));

  return {
    /* Pad the field so the spawn and the chase camera stay inside the ground. */
    ground: {
      width: config.width / FIELD_SCALE + 24,
      depth: config.height / FIELD_SCALE + 24,
    },
    /* Tanks stay inside the field proper; the padding is camera room only. */
    playfield: {
      width: config.width / FIELD_SCALE,
      depth: config.height / FIELD_SCALE,
    },
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
  lookYaw = 0,
  pitch = 0
): CameraPose {
  const heading = player.heading + lookYaw;
  const horizontal = Math.cos(pitch);
  if (mode === 'first') {
    return {
      position: { x: player.position.x, y: 2.75, z: player.position.z },
      target: {
        x: player.position.x + Math.cos(heading) * 20 * horizontal,
        y: 2.75 + Math.sin(pitch) * 20,
        z: player.position.z - Math.sin(heading) * 20 * horizontal,
      },
    };
  }
  const distance = 13;
  /* Positive pitch looks up, so it lowers the chase camera's elevation. */
  const elevation = Math.max(0.06, Math.min(1.05, 1.0 - pitch));
  const height = Math.max(1.9, 1.4 + Math.tan(elevation) * distance);
  return {
    position: {
      x: player.position.x - Math.cos(heading) * distance * horizontal,
      y: height,
      z: player.position.z + Math.sin(heading) * distance * horizontal,
    },
    target: {
      x: player.position.x + Math.cos(heading) * 6,
      y: 1.4 + Math.sin(pitch) * 12,
      z: player.position.z - Math.sin(heading) * 6,
    },
  };
}

/** Moves an enemy toward the player, stopping once inside `standoff`. */
export function stepEnemyToward(
  enemy: Pick<TankPlacement, 'position'>,
  player: { x: number; z: number },
  speed: number,
  deltaSeconds: number,
  standoff: number,
  bounds: { width: number; depth: number }
): { position: Vec3; heading: number; moved: boolean } {
  const dx = player.x - enemy.position.x;
  const dz = player.z - enemy.position.z;
  const distance = Math.hypot(dx, dz);
  const heading = Math.atan2(-dz, dx);
  if (distance <= standoff || !(speed > 0)) {
    return { position: enemy.position, heading, moved: false };
  }
  const step = Math.min(speed * deltaSeconds, distance - standoff);
  const halfWidth = bounds.width / 2;
  const halfDepth = bounds.depth / 2;
  return {
    heading,
    moved: true,
    position: {
      x: Math.max(
        -halfWidth,
        Math.min(halfWidth, enemy.position.x + Math.cos(heading) * step)
      ),
      y: enemy.position.y,
      z: Math.max(
        -halfDepth,
        Math.min(halfDepth, enemy.position.z - Math.sin(heading) * step)
      ),
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
  /*
   * Tracked steering: the hull pivots around its own centre when it is still and
   * traces a wider arc as speed rises, so the circle never drifts off the tank.
   */
  const steerSign = input.forward < 0 ? -1 : 1;
  const speedFactor = Math.abs(input.forward);
  const turnRate = 2.2 + speedFactor * 0.8;
  const heading =
    player.heading + input.turn * steerSign * turnRate * deltaSeconds;
  const speed = 6 * deltaSeconds * input.forward;
  const bounds = layout.playfield ?? layout.ground;
  const halfWidth = bounds.width / 2 - 2.2;
  const halfDepth = bounds.depth / 2 - 2.2;
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

/**
 * Pushes a hull out of any obstacle it overlaps.
 *
 * Obstacles are axis-aligned boxes, so the cheapest escape is along the axis
 * with the smallest penetration. The hull is treated as a circle of `radius`.
 */
export function resolveObstacles(
  position: Vec3,
  radius: number,
  blocks: readonly BlockPlacement[]
): Vec3 {
  let x = position.x;
  let z = position.z;
  for (const block of blocks) {
    const halfX = block.size[0] / 2;
    const halfZ = block.size[2] / 2;
    const dx = x - block.position.x;
    const dz = z - block.position.z;
    const overlapX = halfX + radius - Math.abs(dx);
    const overlapZ = halfZ + radius - Math.abs(dz);
    if (overlapX <= 0 || overlapZ <= 0) continue;
    if (overlapX < overlapZ) {
      x += dx >= 0 ? overlapX : -overlapX;
    } else {
      z += dz >= 0 ? overlapZ : -overlapZ;
    }
  }
  return x === position.x && z === position.z
    ? position
    : { x, y: position.y, z };
}
