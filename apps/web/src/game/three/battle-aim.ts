/**
 * Aiming and dispersion maths for the 3D battle view.
 * Pure so the steering and accuracy rules can be tested without a renderer.
 */
import { normaliseAngle } from './battle-input.js';

/** Heading that points from `from` to `to`, matching the world convention. */
export function aimYaw(
  from: { x: number; z: number },
  to: { x: number; z: number }
): number {
  return Math.atan2(-(to.z - from.z), to.x - from.x);
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
