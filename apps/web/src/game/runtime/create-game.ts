import Phaser from 'phaser';

import { TrainingScene } from '../scenes/TrainingScene.js';
import type { RuntimeLevelConfig, RuntimeState } from './types.js';

export function createGame(
  parent: HTMLElement,
  levelConfig: RuntimeLevelConfig,
  onState: (state: RuntimeState) => void
) {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: levelConfig.width,
    height: levelConfig.height,
    physics: {
      default: 'arcade',
      arcade: { debug: false },
    },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [new TrainingScene(levelConfig, onState)],
  });
}
