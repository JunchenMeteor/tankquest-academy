/**
 * Aiming and dispersion maths for the 3D battle view.
 * Pure so the steering and accuracy rules can be tested without a renderer.
 */
import { Raycaster } from 'three';
import type { Object3D, Ray, Vector3 } from 'three';

import { normaliseAngle } from './battle-input.js';

/** Heading that points from `from` to `to`, matching the world convention. */
export function aimYaw(
  from: { x: number; z: number },
  to: { x: number; z: number }
): number {
  return Math.atan2(-(to.z - from.z), to.x - from.x);
}

/** Positive pitch points down, matching shell travel and camera pitch. */
export function aimPitch(
  from: { x: number; y: number; z: number },
  to: { x: number; y: number; z: number }
): number {
  return Math.atan2(-(to.y - from.y), Math.hypot(to.x - from.x, to.z - from.z));
}

export function resolveAimPoint(
  ray: Ray,
  targets: Object3D[],
  maxRange: number
): Vector3 {
  const raycaster = new Raycaster(ray.origin, ray.direction, 0, maxRange);
  const [hit] = raycaster.intersectObjects(targets, true);
  return hit?.point ?? ray.at(maxRange, ray.origin.clone());
}

export const MAX_GUN_PITCH = Math.PI / 7.2;
export const FIRE_AIM_TOLERANCE = Math.PI / 360;

export function aimAlignmentError(
  from: { x: number; y: number; z: number },
  direction: { x: number; y: number; z: number },
  to: { x: number; y: number; z: number }
): number {
  const target = {
    x: to.x - from.x,
    y: to.y - from.y,
    z: to.z - from.z,
  };
  const directionLength = Math.hypot(direction.x, direction.y, direction.z);
  const targetLength = Math.hypot(target.x, target.y, target.z);
  if (directionLength === 0 || targetLength === 0) return Math.PI;
  const dot =
    (direction.x * target.x + direction.y * target.y + direction.z * target.z) /
    (directionLength * targetLength);
  return Math.acos(Math.max(-1, Math.min(1, dot)));
}

export function clampGunPitch(pitch: number): number {
  return Math.max(-MAX_GUN_PITCH, Math.min(MAX_GUN_PITCH, pitch));
}

/**
 * Turns `current` toward `target` by at most `maxStep` radians, taking the
 * shorter way round. Returns the normalised result.
 */
export function rotateTowards(
  current: number,
  target: number,
  maxStep: number
): number {
  if (!(maxStep > 0)) return normaliseAngle(current);
  const delta = normaliseAngle(target - current);
  if (Math.abs(delta) <= maxStep) return normaliseAngle(target);
  return normaliseAngle(current + Math.sign(delta) * maxStep);
}

/**
 * Random point inside the dispersion circle. Uses the square-root radius so
 * the points stay evenly spread instead of clustering at the centre.
 */
export function dispersionOffset(
  random: () => number,
  radius: number
): { dx: number; dz: number } {
  if (!(radius > 0)) return { dx: 0, dz: 0 };
  const angle = random() * Math.PI * 2;
  const distance = Math.sqrt(random()) * radius;
  return { dx: Math.cos(angle) * distance, dz: Math.sin(angle) * distance };
}

/** Aim point after the shot scatters inside the dispersion circle. */
export function scatterAimPoint(
  point: { x: number; z: number },
  random: () => number,
  radius: number
): { x: number; z: number } {
  const offset = dispersionOffset(random, radius);
  return { x: point.x + offset.dx, z: point.z + offset.dz };
}
