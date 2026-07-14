import type { RuntimeState } from './game/runtime/types.js';

export function readError(reason: unknown) {
  return reason instanceof Error
    ? reason.message
    : 'An unexpected error occurred.';
}

export function emptyRuntimeState(): RuntimeState {
  return {
    enemiesRemaining: 0,
    shotsFired: 0,
    playerHealth: 0,
    playerMaxHealth: 0,
    playerDestroyed: false,
  };
}
