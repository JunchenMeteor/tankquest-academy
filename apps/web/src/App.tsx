import { useCallback, useState } from 'react';

import { GameCanvas } from './game/GameCanvas.js';
import { localTrainingConfig } from './game/config/local-training-config.js';
import type { RuntimeState } from './game/runtime/types.js';
import './styles.css';

export function App() {
  const [runtime, setRuntime] = useState<RuntimeState>({
    enemiesRemaining: localTrainingConfig.enemies.length,
    shotsFired: 0,
  });
  const handleState = useCallback(
    (state: RuntimeState) => setRuntime(state),
    []
  );

  return (
    <main className="app-shell">
      <header className="hud">
        <div>
          <p className="eyebrow">Training Base</p>
          <h1>TankQuest Academy</h1>
        </div>
        <dl>
          <div>
            <dt>Training robots</dt>
            <dd>{runtime.enemiesRemaining}</dd>
          </div>
          <div>
            <dt>Shots fired</dt>
            <dd>{runtime.shotsFired}</dd>
          </div>
        </dl>
      </header>
      <GameCanvas config={localTrainingConfig} onState={handleState} />
      <p className="controls">
        W/S drive · A/D turn · Mouse aim · Click or Space fire
      </p>
    </main>
  );
}
