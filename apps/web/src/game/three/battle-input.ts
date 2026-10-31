/**
 * Maps a raw input snapshot onto the drive and turret commands the 3D view needs.
 * Kept free of Three.js so the steering rules can be unit tested.
 */
import type {
  GameCommand,
  GameInputSnapshot,
} from '../input/GameInputController.js';

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

/** Maps a keyboard key onto the shared command set, or null when unused. */
export function keyToCommand(key: string): GameCommand | null {
  switch (key.toLowerCase()) {
    case 'w':
    case 'arrowup':
      return 'move-forward';
    case 's':
    case 'arrowdown':
      return 'move-backward';
    case 'a':
    case 'arrowleft':
      return 'turn-left';
    case 'd':
    case 'arrowright':
      return 'turn-right';
    case 'q':
      return 'aim-left';
    case 'e':
      return 'aim-right';
    case ' ':
    case 'space':
    case 'spacebar':
      return 'fire';
    default:
      return null;
  }
}
