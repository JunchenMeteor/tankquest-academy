import { useEffect, useRef } from 'react';

import { GameInputController } from './input/GameInputController.js';
import { TouchControls } from './input/TouchControls.js';
import type { RuntimeLevelConfig, RuntimeState } from './runtime/types.js';
import { useI18n } from '../i18n/I18nProvider.js';

interface GameCanvasProps {
  config: RuntimeLevelConfig;
  onState: (state: RuntimeState) => void;
}

export function GameCanvas({ config, onState }: GameCanvasProps) {
  const { t } = useI18n();
  const hostRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<GameInputController | null>(null);
  inputRef.current ??= new GameInputController();
  const input = inputRef.current;

  useEffect(() => {
    const reset = () => input.resetAll();
    window.addEventListener('blur', reset);
    return () => {
      window.removeEventListener('blur', reset);
      reset();
    };
  }, [input]);

  useEffect(() => {
    if (!hostRef.current) {
      return;
    }
    const host = hostRef.current;
    let disposed = false;
    let game: { destroy(removeCanvas?: boolean): void } | undefined;

    void import('./runtime/create-game.js').then(({ createGame }) => {
      if (!disposed) {
        game = createGame(host, config, onState, input);
      }
    });

    return () => {
      disposed = true;
      game?.destroy(true);
    };
  }, [config, input, onState]);

  return (
    <div className="game-stage">
      <div
        className="game-canvas"
        data-map-style={config.mapStyle}
        data-render-mode="2.5d"
        data-scene-theme={config.theme}
        ref={hostRef}
        aria-label={t('touch.trainingArea')}
      />
      <TouchControls
        input={input}
        labels={{
          group: t('touch.group'),
          forward: t('touch.forward'),
          backward: t('touch.backward'),
          turnLeft: t('touch.turnLeft'),
          turnRight: t('touch.turnRight'),
          aimLeft: t('touch.aimLeft'),
          aimRight: t('touch.aimRight'),
          fire: t('touch.fire'),
        }}
      />
    </div>
  );
}
