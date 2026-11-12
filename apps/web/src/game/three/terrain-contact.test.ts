import { describe, expect, it } from 'vitest';

import { terrainGroundPose } from './terrain-contact.js';

describe('terrain ground pose', () => {
  it('keeps a small clearance on flat ground', () => {
    const pose = terrainGroundPose({ x: 2, y: 0, z: 3 }, 0, () => 0);
    expect(pose.position).toEqual({ x: 2, y: 0.08, z: 3 });
    expect(pose.pitch).toBeCloseTo(0);
    expect(pose.roll).toBeCloseTo(0);
  });

  it('pitches the hull with the forward slope', () => {
    const pose = terrainGroundPose({ x: 0, y: 0, z: 0 }, 0, (x) => x * 0.2);
    expect(pose.pitch).toBeCloseTo(Math.atan(0.2));
    expect(pose.roll).toBeCloseTo(0);
    expect(pose.position.y).toBeCloseTo(0.08);
  });

  it('rolls the hull with the side slope', () => {
    const pose = terrainGroundPose({ x: 0, y: 0, z: 0 }, 0, (_x, z) => z * 0.1);
    expect(pose.roll).toBeCloseTo(-Math.atan(0.1));
    expect(pose.pitch).toBeCloseTo(0);
  });

  it('uses the hull heading when sampling front and side contacts', () => {
    const pose = terrainGroundPose(
      { x: 0, y: 0, z: 0 },
      Math.PI / 2,
      (x) => x * 0.2
    );
    expect(pose.pitch).toBeCloseTo(0);
    expect(pose.roll).toBeCloseTo(-Math.atan(0.2));
  });

  it('adds only the clearance required by terrain curvature', () => {
    const pose = terrainGroundPose(
      { x: 0, y: 0, z: 0 },
      0,
      (x) => x * x * 0.05
    );
    expect(pose.position.y).toBeCloseTo(0.3925);
  });

  it('clears a bump between the hull centre and outer contacts', () => {
    const pose = terrainGroundPose({ x: 0, y: 0, z: 0 }, 0, (x) =>
      Math.abs(x - 1.25) < 0.25 ? 0.6 : 0
    );
    expect(pose.position.y).toBeCloseTo(0.68);
  });
});
