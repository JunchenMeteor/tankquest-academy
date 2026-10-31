/**
 * Maps a raw input snapshot onto the drive and turret commands the 3D view needs.
 * Kept free of Three.js so the steering rules can be unit tested.
 */
import type { GameInputSnapshot } from '../input/GameInputController.js';

export interface DriveCommand {
  forward: number;
  turn: number;
  turret: number;
}

export function driveCommand(snapshot: GameInputSnapshot): DriveCommand {
  const forward = Number(snapshot.forward) - Number(snapshot.backward);
  const turn = Number(snapshot.left) - Number(snapshot.right);
  const turret = Number(snapshot.aimLeft) - Number(snapshot.aimRight);
  return { forward, turn, turret };
}

/** Wraps a turret angle so it stays comparable in tests and in the renderer. */
export function normaliseAngle(radians: number): number {
  const wrapped = radians % (Math.PI * 2);
  return wrapped > Math.PI
    ? wrapped - Math.PI * 2
    : wrapped < -Math.PI
      ? wrapped + Math.PI * 2
      : wrapped;
}
