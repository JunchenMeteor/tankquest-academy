import { useEffect } from 'react';

import type {
  GameCommand,
  GameInputController,
} from './GameInputController.js';

interface TouchLabels {
  group: string;
  forward: string;
  backward: string;
  turnLeft: string;
  turnRight: string;
  aimLeft: string;
  aimRight: string;
  fire: string;
}

export function TouchControls({
  input,
  labels,
}: {
  input: GameInputController;
  labels: TouchLabels;
}) {
  useEffect(() => () => input.resetSource('touch'), [input]);
  return (
    <section className="touch-controls" aria-label={labels.group}>
      <div className="touch-control-cluster" aria-label={labels.group}>
        <CommandButton
          command="move-forward"
          input={input}
          label={labels.forward}
          symbol="▲"
        />
        <CommandButton
          command="turn-left"
          input={input}
          label={labels.turnLeft}
          symbol="◀"
        />
        <CommandButton
          command="turn-right"
          input={input}
          label={labels.turnRight}
          symbol="▶"
        />
        <CommandButton
          command="move-backward"
          input={input}
          label={labels.backward}
          symbol="▼"
        />
      </div>
      <div className="touch-control-cluster touch-aim-controls">
        <CommandButton
          command="aim-left"
          input={input}
          label={labels.aimLeft}
          symbol="↶"
        />
        <CommandButton
          command="fire"
          input={input}
          label={labels.fire}
          symbol="●"
          variant="fire"
        />
        <CommandButton
          command="aim-right"
          input={input}
          label={labels.aimRight}
          symbol="↷"
        />
      </div>
    </section>
  );
}

function CommandButton({
  command,
  input,
  label,
  symbol,
  variant,
}: {
  command: GameCommand;
  input: GameInputController;
  label: string;
  symbol: string;
  variant?: 'fire';
}) {
  const release = () => input.setCommand(command, false, 'touch');
  return (
    <button
      aria-label={label}
      className={variant === 'fire' ? 'touch-fire' : undefined}
      data-touch-command={command}
      onContextMenu={(event) => event.preventDefault()}
      onPointerCancel={release}
      onPointerDown={(event) => {
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        input.setCommand(command, true, 'touch');
      }}
      onPointerUp={release}
      onLostPointerCapture={release}
      type="button"
    >
      {symbol}
    </button>
  );
}
