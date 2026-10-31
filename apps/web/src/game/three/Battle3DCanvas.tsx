import { useEffect, useRef, useState } from 'react';

import { createBattleView, type Battle3DHandle } from './battle-view.js';
import { GameInputController } from '../input/GameInputController.js';
import { keyToCommand } from './battle-input.js';
import { TouchControls } from '../input/TouchControls.js';
import { useI18n } from '../../i18n/I18nProvider.js';
import type { RuntimeLevelConfig, RuntimeState } from '../runtime/types.js';

interface Battle3DCanvasProps {
  config: RuntimeLevelConfig;
  onState: (state: RuntimeState) => void;
}

/**
 * Mounts the Three.js battle view and exposes the camera toggle.
 * Session, learning and reward rules stay in the existing React/Phaser pipeline.
 */
export function Battle3DCanvas({ config, onState }: Battle3DCanvasProps) {
  const { t } = useI18n();
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<Battle3DHandle | null>(null);
  const inputRef = useRef<GameInputController | null>(null);
  inputRef.current ??= new GameInputController();
  const input = inputRef.current;
  const [mode, setMode] = useState<'third' | 'first'>('third');

  useEffect(() => {
    if (!hostRef.current) return;
    const view = createBattleView(hostRef.current, config, input, onState);
    viewRef.current = view;
    return () => {
      view.dispose();
      viewRef.current = null;
    };
  }, [config, input, onState]);

  useEffect(() => {
    viewRef.current?.setMode(mode);
  }, [mode]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const command = keyToCommand(event.key);
      if (!command) return;
      if (command === 'fire') event.preventDefault();
      input.setCommand(command, true, 'keyboard');
    };
    const onKeyUp = (event: KeyboardEvent) => {
      const command = keyToCommand(event.key);
      if (command) input.setCommand(command, false, 'keyboard');
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      input.resetSource('keyboard');
    };
  }, [input]);

  return (
    <div className="game-stage" data-render-mode="3d">
      <div
        className="game-canvas game-canvas-3d"
        data-map-style={config.mapStyle}
        data-scene-theme={config.theme}
        ref={hostRef}
      >
        <button
          type="button"
          className="battle-camera-toggle"
          onClick={() =>
            setMode((current) => (current === 'third' ? 'first' : 'third'))
          }
        >
          {mode === 'third' ? 'First-person view' : 'Third-person view'}
        </button>
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
