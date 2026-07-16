import type Phaser from 'phaser';

import type {
  ObstacleRuntimeConfig,
  RuntimeLevelConfig,
} from '../runtime/types.js';
import type { ScenePalette } from './map-visual-definition.js';

export function drawTrainingGround(
  scene: Phaser.Scene,
  width: number,
  height: number,
  style: RuntimeLevelConfig['mapStyle'],
  palette: ScenePalette
) {
  const graphics = scene.add.graphics().setDepth(-20);
  graphics.fillStyle(palette.floor.base).fillRect(0, 0, width, height);
  graphics.lineStyle(1, palette.floor.grid, 0.38);
  for (let x = -height; x < width + height; x += 64) {
    graphics.lineBetween(x, 0, x + height, height);
    graphics.lineBetween(x, 0, x - height, height);
  }

  graphics.lineStyle(3, palette.floor.accent, 0.72);
  if (style === 'range') {
    for (let x = 165; x < width; x += 145) {
      graphics.lineBetween(x, 20, x, height - 20);
    }
    graphics.strokeCircle(width - 125, height / 2, 76);
    graphics.strokeCircle(width - 125, height / 2, 38);
  } else if (style === 'gate') {
    graphics.fillStyle(palette.floor.accent, 0.14).fillRect(0, 205, width, 130);
    graphics.strokeRect(315, 185, 70, 170);
    graphics.strokeRect(535, 125, 72, 290);
    for (let x = 35; x < width; x += 100) {
      graphics.lineBetween(x, height / 2, x + 50, height / 2);
    }
  } else {
    graphics.strokeCircle(300, 270, 120);
    graphics.strokeCircle(720, 270, 136);
    graphics.lineBetween(0, 270, width, 270);
    graphics.lineBetween(width / 2, 0, width / 2, height);
  }

  drawBoundary(graphics, width, height, palette);
  return graphics;
}

export function obstacleVisualGeometry(obstacle: ObstacleRuntimeConfig) {
  const left = obstacle.x - obstacle.width / 2;
  const top = obstacle.y - obstacle.height / 2;
  const right = left + obstacle.width;
  const bottom = top + obstacle.height;
  const extrusion = Math.min(12, Math.max(6, obstacle.height * 0.12));
  return {
    top: { x: left, y: top, width: obstacle.width, height: obstacle.height },
    side: [
      { x: left, y: bottom },
      { x: right, y: bottom },
      { x: right + extrusion, y: bottom + extrusion },
      { x: left + extrusion, y: bottom + extrusion },
    ],
    shadow: [
      { x: left + extrusion, y: top + extrusion },
      { x: right + extrusion, y: top + extrusion },
      { x: right + extrusion, y: bottom + extrusion },
      { x: left + extrusion, y: bottom + extrusion },
    ],
    extrusion,
  };
}

export function drawObstacleVisual(
  scene: Phaser.Scene,
  obstacle: ObstacleRuntimeConfig,
  palette: ScenePalette
) {
  const geometry = obstacleVisualGeometry(obstacle);
  const shadowPoints = geometry.shadow as Phaser.Math.Vector2[];
  const sidePoints = geometry.side as Phaser.Math.Vector2[];
  const graphics = scene.add
    .graphics()
    .setDepth(100 + Math.round(obstacle.y + obstacle.height / 2));
  graphics
    .fillStyle(palette.shadow.color, palette.shadow.alpha)
    .fillPoints(shadowPoints, true)
    .fillStyle(palette.obstacle.side)
    .fillPoints(sidePoints, true)
    .fillStyle(palette.obstacle.top)
    .fillRect(
      geometry.top.x,
      geometry.top.y,
      geometry.top.width,
      geometry.top.height
    )
    .lineStyle(2, palette.boundary.top, 0.7)
    .strokeRect(
      geometry.top.x,
      geometry.top.y,
      geometry.top.width,
      geometry.top.height
    );
  return graphics;
}

export function applyTankDepth(
  body: Phaser.Physics.Arcade.Sprite,
  turret: Phaser.GameObjects.Image,
  healthBar?: Phaser.GameObjects.Graphics
) {
  const depth = 100 + Math.round(body.y);
  body.setDepth(depth);
  turret.setDepth(depth + 1);
  healthBar?.setDepth(depth + 2);
}

export function mapVisualSignature(style: RuntimeLevelConfig['mapStyle']) {
  return {
    range: 'lanes-and-target',
    gate: 'corridor-and-gates',
    patrol: 'cross-grid-and-zones',
  }[style];
}

function drawBoundary(
  graphics: Phaser.GameObjects.Graphics,
  width: number,
  height: number,
  palette: ScenePalette
) {
  const thickness = 12;
  graphics
    .fillStyle(palette.boundary.side)
    .fillRect(0, height - thickness, width, thickness)
    .fillRect(width - thickness, 0, thickness, height)
    .fillStyle(palette.boundary.top)
    .fillRect(0, 0, width, 5)
    .fillRect(0, 0, 5, height)
    .lineStyle(2, palette.boundary.top, 0.9)
    .strokeRect(5, 5, width - thickness, height - thickness);
}
