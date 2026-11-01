import { describe, expect, it } from 'vitest';

import {
  FIELD_SCALE,
  buildSceneLayout,
  cameraPose,
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
    expect(layout.player.position.x).toBeCloseTo(120 / FIELD_SCALE);
    expect(layout.player.position.z).toBeCloseTo(270 / FIELD_SCALE);
    expect(layout.enemies).toHaveLength(1);
    expect(layout.enemies[0]?.color ?? 0).toBeGreaterThan(0);
    expect(layout.blocks).toHaveLength(1);
    expect(layout.blocks[0]?.size[0] ?? 0).toBeCloseTo(80 / FIELD_SCALE);
  });

  it('keeps the first-person camera on the turret and looking forward', () => {
    const pose = cameraPose('first', {
      position: { x: 0, y: 0, z: 0 },
      heading: 0,
    });
    expect(pose.position).toEqual({ x: 0, y: 2.75, z: 0 });
    expect(pose.target.x).toBeCloseTo(20);
    expect(pose.target.y).toBeCloseTo(2.75);
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
    expect(pose.position.x).toBeCloseTo(-11);
    expect(pose.position.y).toBeCloseTo(6.8);
    expect(pose.position.z).toBeCloseTo(0);
  });

  it('drives forward along the heading and stays inside the field', () => {
    const layout = buildSceneLayout(config);
    const moved = stepTank(
      { position: { x: 0, y: 0, z: 0 }, heading: 0 },
      { forward: 1, turn: 0 },
      1,
      layout
    );
    expect(moved.position.x).toBeCloseTo(6);
    expect(moved.position.z).toBeCloseTo(0);

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
