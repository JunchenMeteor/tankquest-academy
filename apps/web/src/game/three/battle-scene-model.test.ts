import { describe, expect, it } from 'vitest';

import {
  FIELD_SCALE,
  buildSceneLayout,
  cameraPose,
  groundHeight,
  resolveCameraPose,
  resolveObstacles,
  stepEnemyToward,
  stepTank,
  toWorld,
} from './battle-scene-model.js';
import type { RuntimeLevelConfig } from '../runtime/types.js';

const config = {
  id: 'level_1',
  code: 'addition-range',
  width: 960,
  height: 540,
  mapStyle: 'range',
  theme: 'forest-camp',
  playerSpawn: { x: 120, y: 270 },
  player: {
    maxHealth: 150,
    speed: 170,
    mass: 110,
    armorProfile: { front: 78, side: 58, rear: 42 },
    projectileDamage: 48,
    projectilePenetration: 106,
    projectileSpeed: 380,
    detectionRange: 280,
    visibilityMultiplier: 1,
    visualCode: 'star-shield',
  },
  enemies: [
    {
      id: 'enemy_1',
      role: 'scout',
      x: 720,
      y: 200,
      maxHealth: 100,
      armorReduction: 0.2,
      armorProfile: { front: 54, side: 40, rear: 30 },
      mass: 60,
      speed: 79,
      detectionRange: 300,
      attackRange: 220,
      projectileDamage: 15,
      projectilePenetration: 40,
      projectileSpeed: 320,
      fireCooldownMs: 1900,
    },
  ],
  obstacles: [{ x: 480, y: 270, width: 80, height: 120 }],
} as unknown as RuntimeLevelConfig;

describe('3D battle scene model', () => {
  it('maps field coordinates into world space with the field scale', () => {
    expect(toWorld(FIELD_SCALE, FIELD_SCALE * 2)).toEqual({ x: 1, y: 0, z: 2 });
  });

  it('places the player, enemies and obstacles from the runtime config', () => {
    const layout = buildSceneLayout(config);
    /* The ground adds a margin so the spawn and chase camera stay inside it. */
    expect(layout.ground.width).toBeCloseTo(960 / FIELD_SCALE + 24);
    expect(layout.ground.depth).toBeCloseTo(540 / FIELD_SCALE + 24);
    expect(layout.player.position.x).toBeCloseTo((120 - 480) / FIELD_SCALE);
    expect(layout.player.position.z).toBeCloseTo(0);
    expect(layout.enemies).toHaveLength(1);
    expect(layout.enemies[0]?.position.x).toBeCloseTo(
      (720 - 480) / FIELD_SCALE
    );
    expect(layout.enemies[0]?.position.z).toBeCloseTo(
      (200 - 270) / FIELD_SCALE
    );
    expect(layout.enemies[0]?.color ?? 0).toBeGreaterThan(0);
    expect(layout.blocks.length).toBeGreaterThan(1);
    expect(layout.blocks[0]?.position.x).toBe(0);
    expect(layout.blocks[0]?.position.z).toBe(0);
    expect(layout.blocks[0]?.size[0] ?? 0).toBeCloseTo(80 / FIELD_SCALE);
    expect(layout.blocks[0]?.size[1]).toBe(1.8);
    expect(layout.blocks[0]?.position.y).toBeCloseTo(groundHeight(0, 0) + 0.9);
  });

  it('places zero-elevation passive targets on the local terrain', () => {
    const layout = buildSceneLayout({
      ...config,
      enemies: [
        {
          ...config.enemies[0]!,
          id: 'target_mid_low',
          x: 540,
          y: 340,
          elevation: 0,
          passive: true,
        },
      ],
    });
    expect(layout.enemies[0]?.position.y).toBeCloseTo(0.8814526199323324);
  });

  it('keeps the first-person camera on the turret and looking forward', () => {
    const pose = cameraPose('first', {
      position: { x: 0, y: 0, z: 0 },
      heading: 0,
    });
    expect(pose.position).toEqual({ x: 0, y: 1.95, z: 0 });
    expect(pose.target.x).toBeCloseTo(20);
    expect(pose.target.y).toBeCloseTo(1.95);
  });

  it('tilts the first-person view with pitch and turns it with yaw', () => {
    const up = cameraPose(
      'first',
      { position: { x: 0, y: 0, z: 0 }, heading: 0 },
      0,
      0.3
    );
    expect(up.target.y).toBeGreaterThan(3);

    const right = cameraPose(
      'first',
      { position: { x: 0, y: 0, z: 0 }, heading: 0 },
      -Math.PI / 2
    );
    expect(right.target.z).toBeCloseTo(20);
  });

  it('puts the third-person camera behind the heading', () => {
    const pose = cameraPose('third', {
      position: { x: 0, y: 0, z: 0 },
      heading: 0,
    });
    expect(pose.position.x).toBeCloseTo(-13);
    expect(pose.position.y).toBeGreaterThan(6);
    expect(pose.position.z).toBeCloseTo(0);
  });

  it('keeps the chase camera above terrain and out of obstacles', () => {
    const ground = { width: 100, depth: 100 };
    const blocked = resolveCameraPose(
      {
        position: { x: -8, y: 2, z: 0 },
        target: { x: 6, y: 1.4, z: 0 },
      },
      { x: 0, y: 0, z: 0 },
      [
        {
          position: { x: -4, y: 2, z: 0 },
          size: [2, 4, 4],
        },
      ],
      ground
    );
    expect(blocked.position.x).toBeGreaterThan(-3);
    expect(blocked.position.x).toBeLessThan(0);

    const low = resolveCameraPose(
      {
        position: { x: 2, y: -2, z: 3 },
        target: { x: 0, y: 1.4, z: 0 },
      },
      { x: 0, y: 0, z: 0 },
      [],
      ground
    );
    expect(low.position.y).toBeCloseTo(groundHeight(2, 3) + 0.45);
  });

  it('lifts a heavily obstructed camera above the hull and obstruction', () => {
    const resolved = resolveCameraPose(
      {
        position: { x: -8, y: 2, z: 0 },
        target: { x: 6, y: 1.4, z: 0 },
      },
      { x: 0, y: 0, z: 0 },
      [
        {
          position: { x: -1.5, y: 2, z: 0 },
          size: [3, 4, 4],
        },
      ],
      { width: 100, depth: 100 }
    );
    expect(resolved.position.y).toBeCloseTo(4.25);
  });

  it('accelerates toward full speed and coasts after input is released', () => {
    const layout = buildSceneLayout(config);
    const launched = stepTank(
      { position: { x: 0, y: 0, z: 0 }, heading: 0 },
      { forward: 1, turn: 0 },
      0.1,
      layout
    );
    expect(launched.trackSpeed).toBeGreaterThan(0);
    expect(launched.trackSpeed).toBeLessThan(6);

    const reached = stepTank(launched, { forward: 1, turn: 0 }, 1, layout);
    expect(reached.trackSpeed).toBeCloseTo(6);
    expect(reached.position.x).toBeGreaterThan(launched.position.x);
    expect(reached.position.x).toBeLessThan(6);
    expect(reached.position.z).toBeCloseTo(0);

    const coasted = stepTank(reached, { forward: 0, turn: 0 }, 0.1, layout);
    expect(coasted.trackSpeed).toBeGreaterThan(0);
    expect(coasted.trackSpeed).toBeLessThan(reached.trackSpeed);
    expect(coasted.position.x).toBeGreaterThan(reached.position.x);
  });

  it('stays inside the field while accelerating', () => {
    const layout = buildSceneLayout(config);
    const clamped = stepTank(
      { position: { x: layout.ground.width / 2, y: 0, z: 0 }, heading: 0 },
      { forward: 1, turn: 0 },
      5,
      layout
    );
    expect(clamped.position.x).toBeLessThanOrEqual(layout.ground.width / 2);
  });
});

describe('enemy approach', () => {
  const bounds = { width: 40, depth: 30 };

  it('closes the distance toward the player and stops at the standoff', () => {
    const roomy = stepEnemyToward(
      { position: { x: 10, y: 0, z: 0 } },
      { x: 0, z: 0 },
      6,
      1,
      2,
      bounds
    );
    expect(roomy.moved).toBe(true);
    expect(roomy.position.x).toBeCloseTo(4);
    expect(Math.abs(roomy.heading)).toBeCloseTo(Math.PI);

    const close = stepEnemyToward(
      { position: { x: 1, y: 0, z: 0 } },
      { x: 0, z: 0 },
      6,
      1,
      2,
      bounds
    );
    expect(close.moved).toBe(false);
    expect(close.position.x).toBe(1);
  });
});

describe('reverse steering', () => {
  const layout = buildSceneLayout(config as RuntimeLevelConfig);

  it('turns the other way when the tank backs up', () => {
    const forward = stepTank(
      { position: { x: 0, y: 0, z: 0 }, heading: 0 },
      { forward: 1, turn: 1 },
      0.5,
      layout
    );
    const backward = stepTank(
      { position: { x: 0, y: 0, z: 0 }, heading: 0 },
      { forward: -1, turn: 1 },
      0.5,
      layout
    );
    expect(forward.heading).toBeGreaterThan(0);
    expect(backward.heading).toBeLessThan(0);
  });
});

describe('tracked steering', () => {
  const layout = buildSceneLayout(config as RuntimeLevelConfig);

  it('pivots on the spot without moving when only turning', () => {
    const turned = stepTank(
      { position: { x: 0, y: 0, z: 0 }, heading: 0 },
      { forward: 0, turn: 1 },
      0.5,
      layout
    );
    expect(turned.heading).toBeGreaterThan(0);
    expect(turned.position.x).toBeCloseTo(0);
    expect(turned.position.z).toBeCloseTo(0);
  });

  it('ramps steering up and settles smoothly after the key is released', () => {
    const started = stepTank(
      { position: { x: 0, y: 0, z: 0 }, heading: 0 },
      { forward: 0, turn: 1 },
      0.05,
      layout
    );
    expect(started.turnRate).toBeGreaterThan(0);
    expect(started.turnRate).toBeLessThan(1.96);

    const turning = stepTank(started, { forward: 0, turn: 1 }, 0.2, layout);
    expect(turning.turnRate).toBeGreaterThan(started.turnRate);

    const settling = stepTank(turning, { forward: 0, turn: 0 }, 0.1, layout);
    expect(settling.turnRate).toBeGreaterThan(0);
    expect(settling.turnRate).toBeLessThan(turning.turnRate);
  });

  it('keeps the turning circle tight enough to stay around the hull', () => {
    const moving = stepTank(
      { position: { x: 0, y: 0, z: 0 }, heading: 0 },
      { forward: 1, turn: 1 },
      1,
      layout
    );
    const turned = Math.abs(moving.heading);
    const travelled = Math.hypot(moving.position.x, moving.position.z);
    const radius = travelled / turned;
    expect(radius).toBeLessThan(3);
  });

  it('clamps the hull to the playfield, not the camera padding', () => {
    const far = stepTank(
      { position: { x: 999, y: 0, z: 999 }, heading: 0 },
      { forward: 1, turn: 0 },
      1,
      layout
    );
    expect(Math.abs(far.position.x)).toBeLessThanOrEqual(
      layout.playfield.width / 2
    );
    expect(Math.abs(far.position.z)).toBeLessThanOrEqual(
      layout.playfield.depth / 2
    );
  });
});

describe('terrain and generated cover', () => {
  it('expands the battlefield and keeps generated cover away from spawns', () => {
    const layout = buildSceneLayout(config as RuntimeLevelConfig);
    expect(layout.playfield.width).toBeCloseTo(96);
    expect(layout.playfield.depth).toBeCloseTo(54);
    expect(layout.blocks.length).toBeGreaterThan(3);
    for (const block of layout.blocks.slice(1)) {
      expect(
        Math.hypot(
          block.position.x - layout.player.position.x,
          block.position.z - layout.player.position.z
        )
      ).toBeGreaterThan(2.5);
      expect(
        Math.hypot(
          block.position.x - layout.enemies[0]!.position.x,
          block.position.z - layout.enemies[0]!.position.z
        )
      ).toBeGreaterThan(2.5);
    }
  });

  it('makes the height variation visible instead of nearly flat', () => {
    expect(Math.abs(groundHeight(4, 7) - groundHeight(-3, -2))).toBeGreaterThan(
      0.5
    );
  });

  it('applies terrain height to tanks and both camera modes', () => {
    const layout = buildSceneLayout(config as RuntimeLevelConfig);
    const player = stepTank(
      { position: { x: 2, y: 0, z: 3 }, heading: 0 },
      { forward: 0, turn: 0 },
      0.1,
      layout
    );
    expect(player.position.y).toBeCloseTo(groundHeight(2, 3));

    const enemy = stepEnemyToward(
      { position: { x: 2, y: 0, z: 3 } },
      { x: 8, z: 8 },
      1,
      0.1,
      0,
      layout.playfield
    );
    expect(enemy.position.y).toBeCloseTo(
      groundHeight(enemy.position.x, enemy.position.z)
    );

    const first = cameraPose('first', {
      position: { x: 0, y: 2, z: 0 },
      heading: 0,
    });
    expect(first.position.y).toBe(3.95);
    const third = cameraPose('third', {
      position: { x: 0, y: 2, z: 0 },
      heading: 0,
    });
    expect(third.position.y).toBeGreaterThan(7);
    expect(third.target.y).toBeGreaterThan(3);
  });

  it('recomputes ground height after obstacle separation', () => {
    const blocks = [
      {
        position: { x: 0, y: 0.9, z: 0 },
        size: [4, 1.8, 4] as [number, number, number],
      },
    ];
    const resolved = resolveObstacles(
      { x: 0.2, y: 0, z: 0.1 },
      1.9,
      blocks,
      groundHeight
    );
    expect(resolved.y).toBeCloseTo(groundHeight(resolved.x, resolved.z));
  });
});

describe('obstacle collision', () => {
  const blocks = [
    {
      position: { x: 0, y: 0.55, z: 0 },
      size: [4, 1.1, 4] as [number, number, number],
    },
  ];

  it('pushes a hull out of a block along the shallow axis', () => {
    const outside = resolveObstacles({ x: 3.2, y: 0, z: 0 }, 1.9, blocks);
    expect(outside.x).toBeGreaterThanOrEqual(3.9);

    const blocked = resolveObstacles({ x: 0.2, y: 0, z: 0.1 }, 1.9, blocks);
    expect(Math.abs(blocked.x) >= 3.9 || Math.abs(blocked.z) >= 3.9).toBe(true);
  });

  it('leaves a clear hull untouched', () => {
    const clear = resolveObstacles({ x: 12, y: 0, z: 12 }, 1.9, blocks);
    expect(clear).toEqual({ x: 12, y: 0, z: 12 });
  });
});
