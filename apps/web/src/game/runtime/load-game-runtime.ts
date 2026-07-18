import type { createGame } from './create-game.js';

export interface GameRuntimeModule {
  createGame: typeof createGame;
}
export type GameRuntimeLoader = () => Promise<GameRuntimeModule>;

export const loadGameRuntime: GameRuntimeLoader = () =>
  import('./create-game.js');

export async function warmGameRuntime(
  loader: GameRuntimeLoader = loadGameRuntime
) {
  try {
    await loader();
    return true;
  } catch {
    return false;
  }
}
