import { useEffect, useRef, useState } from 'react';

import { GameInputController } from './input/GameInputController.js';
import { TouchControls } from './input/TouchControls.js';
import {
  loadGameRuntime,
  type GameRuntimeLoader,
} from './runtime/load-game-runtime.js';
import type { RuntimeLevelConfig, RuntimeState } from './runtime/types.js';
import { useI18n } from '../i18n/I18nProvider.js';

interface GameCanvasProps {
  config: RuntimeLevelConfig;
  onState: (state: RuntimeState) => void;
  loadRuntime?: GameRuntimeLoader;
  onReload?: () => void;
}

const reloadPage = () => globalThis.location.reload();

export function GameCanvas({
  config,
  onState,
  loadRuntime = loadGameRuntime,
  onReload = reloadPage,
}: GameCanvasProps) {
  const { t } = useI18n();
  const [loadFailed, setLoadFailed] = useState(false);
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

    setLoadFailed(false);
    void loadRuntime()
      .then(({ createGame }) => {
        if (!disposed) {
          game = createGame(host, config, onState, input);
        }
      })
      .catch(() => {
        if (!disposed) setLoadFailed(true);
      });

    return () => {
      disposed = true;
      game?.destroy(true);
    };
  }, [config, input, loadRuntime, onState]);

  return (
    <div className="game-stage">
      <div
        className="game-canvas"
        data-map-style={config.mapStyle}
        data-render-mode="2.5d"
        data-scene-theme={config.theme}
        ref={hostRef}
        aria-label={t('touch.trainingArea')}
      >
        {loadFailed && (
          <div className="game-load-error" role="alert">
            <p>{t('game.loadFailed')}</p>
            <button type="button" onClick={onReload}>
              {t('action.refreshGame')}
            </button>
          </div>
        )}
      </div>
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
