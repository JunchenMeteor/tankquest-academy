import { useEffect, useRef, useState } from 'react';

import { createBattleView, type Battle3DHandle } from './battle-view.js';
import type { RuntimeLevelConfig } from '../runtime/types.js';

interface Battle3DCanvasProps {
  config: RuntimeLevelConfig;
}

/**
 * Mounts the Three.js battle view and exposes the camera toggle.
 * Session, learning and reward rules stay in the existing React/Phaser pipeline.
 */
export function Battle3DCanvas({ config }: Battle3DCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<Battle3DHandle | null>(null);
  const [mode, setMode] = useState<'third' | 'first'>('third');

  useEffect(() => {
    if (!hostRef.current) return;
    const view = createBattleView(hostRef.current, config);
    viewRef.current = view;
    return () => {
      view.dispose();
      viewRef.current = null;
    };
  }, [config]);

  useEffect(() => {
    viewRef.current?.setMode(mode);
  }, [mode]);

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
    </div>
  );
}
