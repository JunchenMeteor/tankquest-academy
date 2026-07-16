export type GameCommand =
  | 'move-forward'
  | 'move-backward'
  | 'turn-left'
  | 'turn-right'
  | 'aim-left'
  | 'aim-right'
  | 'fire';

export interface GameInputSnapshot {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  aimLeft: boolean;
  aimRight: boolean;
  fire: boolean;
  aimTarget: { x: number; y: number } | null;
}

const commands: GameCommand[] = [
  'move-forward',
  'move-backward',
  'turn-left',
  'turn-right',
  'aim-left',
  'aim-right',
  'fire',
];

export class GameInputController {
  private readonly sources = new Map<GameCommand, Set<string>>(
    commands.map((command) => [command, new Set()])
  );
  private aimTarget: GameInputSnapshot['aimTarget'] = null;
  private fireRequested = false;

  setCommand(command: GameCommand, pressed: boolean, source: string) {
    const activeSources = this.sources.get(command)!;
    const wasPressed = activeSources.has(source);
    if (pressed) activeSources.add(source);
    else activeSources.delete(source);
    if ((command === 'aim-left' || command === 'aim-right') && pressed) {
      this.aimTarget = null;
    }
    if (command === 'fire' && pressed && !wasPressed) {
      this.fireRequested = true;
    }
  }

  setAimTarget(x: number, y: number) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    this.aimTarget = { x, y };
  }

  consumeFireRequest() {
    const requested = this.fireRequested;
    this.fireRequested = false;
    return requested;
  }

  snapshot(): GameInputSnapshot {
    return {
      forward: this.active('move-forward'),
      backward: this.active('move-backward'),
      left: this.active('turn-left'),
      right: this.active('turn-right'),
      aimLeft: this.active('aim-left'),
      aimRight: this.active('aim-right'),
      fire: this.active('fire'),
      aimTarget: this.aimTarget ? { ...this.aimTarget } : null,
    };
  }

  resetSource(source: string) {
    for (const activeSources of this.sources.values()) {
      activeSources.delete(source);
    }
  }

  resetAll() {
    for (const activeSources of this.sources.values()) activeSources.clear();
    this.aimTarget = null;
    this.fireRequested = false;
  }

  private active(command: GameCommand) {
    return this.sources.get(command)!.size > 0;
  }
}
