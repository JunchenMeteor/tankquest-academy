import { useEffect, useRef } from 'react';

import type { RuntimeLevelConfig, RuntimeState } from './runtime/types.js';

interface GameCanvasProps {
  config: RuntimeLevelConfig;
  onState: (state: RuntimeState) => void;
}

export function GameCanvas({ config, onState }: GameCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hostRef.current) {
      return;
    }
    const host = hostRef.current;
    let disposed = false;
    let game: { destroy(removeCanvas?: boolean): void } | undefined;

    void import('./runtime/create-game.js').then(({ createGame }) => {
      if (!disposed) {
        game = createGame(host, config, onState);
      }
    });

    return () => {
      disposed = true;
      game?.destroy(true);
    };
  }, [config, onState]);

  return (
    <div
      className="game-canvas"
      ref={hostRef}
      aria-label="Tank training area"
    />
  );
}
