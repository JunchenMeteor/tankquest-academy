import type { Object3D } from 'three';
import type { Vec3 } from './battle-scene-model.js';

export function terrainGroundPose(
  position: Vec3,
  heading: number,
  ground: (x: number, z: number) => number
): { position: Vec3; pitch: number; roll: number } {
  const halfWidth = 1.5;
  const halfLength = 2.5;
  const forward = {
    x: Math.cos(heading) * halfLength,
    z: -Math.sin(heading) * halfLength,
  };
  const side = {
    x: Math.sin(heading) * halfWidth,
    z: Math.cos(heading) * halfWidth,
  };
  const centre = ground(position.x, position.z);
  const front = ground(position.x + forward.x, position.z + forward.z);
  const back = ground(position.x - forward.x, position.z - forward.z);
  const right = ground(position.x + side.x, position.z + side.z);
  const left = ground(position.x - side.x, position.z - side.z);
  const forwardSlope = (front - back) / (halfLength * 2);
  const sideSlope = (right - left) / (halfWidth * 2);
  let contactClearance = 0;
  for (const longitudinal of [-1, -0.5, 0, 0.5, 1]) {
    for (const lateral of [-1, -0.5, 0, 0.5, 1]) {
      const forwardOffset = longitudinal * halfLength;
      const sideOffset = lateral * halfWidth;
      const actual = ground(
        position.x +
          Math.cos(heading) * forwardOffset +
          Math.sin(heading) * sideOffset,
        position.z -
          Math.sin(heading) * forwardOffset +
          Math.cos(heading) * sideOffset
      );
      const predicted =
        centre + forwardSlope * forwardOffset + sideSlope * sideOffset;
      contactClearance = Math.max(contactClearance, actual - predicted);
    }
  }
  return {
    position: {
      x: position.x,
      y: centre + contactClearance + 0.08,
      z: position.z,
    },
    pitch: Math.atan(forwardSlope),
    roll: -Math.atan(sideSlope),
  };
}

export function applyTankGroundPose(
  root: Object3D,
  position: Vec3,
  heading: number,
  ground: (x: number, z: number) => number
): void {
  const pose = terrainGroundPose(position, heading, ground);
  root.position.copy(pose.position);
  root.rotation.set(pose.roll, heading, pose.pitch, 'YXZ');
}
