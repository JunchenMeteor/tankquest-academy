import type Phaser from 'phaser';

import type { RuntimeLevelConfig } from '../runtime/types.js';
import {
  type TankRole,
  type TankVisualDefinition,
  resolveEnemyTankVisual,
  resolvePlayerTankVisual,
} from './tank-visual-definition.js';

export const PLAYER_BODY_TEXTURE = 'tank-body';
export const PLAYER_TURRET_TEXTURE = 'tank-turret';

export function enemyBodyTexture(role: TankRole) {
  return `enemy-${role}-body`;
}

export function enemyTurretTexture(role: TankRole) {
  return `enemy-${role}-turret`;
}

export function createTankVisualTextures(
  scene: Phaser.Scene,
  config: RuntimeLevelConfig
) {
  const graphics = scene.add.graphics();
  const player = resolvePlayerTankVisual(
    config.player.visualCode,
    config.visualResources
  );
  drawTankTextures(
    scene,
    graphics,
    PLAYER_BODY_TEXTURE,
    PLAYER_TURRET_TEXTURE,
    player,
    {
      primary: config.player.appearance?.primaryColor ?? 0x5d7d46,
      secondary: config.player.appearance?.secondaryColor ?? 0xe8c65a,
      tracks: 0x293129,
    }
  );

  const enemyColors: Record<
    TankRole,
    { primary: number; secondary: number; tracks: number }
  > = {
    scout: { primary: 0xb95b4b, secondary: 0xffb08d, tracks: 0x392522 },
    medium: { primary: 0xa6483c, secondary: 0xf18b73, tracks: 0x352321 },
    heavy: { primary: 0x87372f, secondary: 0xd36a58, tracks: 0x2d201e },
  };
  for (const role of ['scout', 'medium', 'heavy'] as const) {
    drawTankTextures(
      scene,
      graphics,
      enemyBodyTexture(role),
      enemyTurretTexture(role),
      resolveEnemyTankVisual(role, config.visualResources),
      enemyColors[role]
    );
  }
  graphics.destroy();
}

export function configureTurretOrigin(
  turret: Phaser.GameObjects.Image,
  definition: TankVisualDefinition
) {
  const { x, y } = turretOrigin(definition);
  turret.setOrigin(x, y);
  return turret;
}

export function turretOrigin(definition: TankVisualDefinition) {
  const padding = 2;
  const center = padding + definition.turret.radius;
  return {
    x:
      center /
      (padding * 2 +
        definition.turret.radius * 2 +
        definition.turret.barrelLength),
    y: 0.5,
  };
}

export function lockTankBody(
  sprite: Phaser.Physics.Arcade.Sprite,
  size: { width: number; height: number }
) {
  const body = sprite.body as Phaser.Physics.Arcade.Body;
  body.setSize(size.width, size.height, true);
}

function drawTankTextures(
  scene: Phaser.Scene,
  graphics: Phaser.GameObjects.Graphics,
  bodyKey: string,
  turretKey: string,
  definition: TankVisualDefinition,
  colors: { primary: number; secondary: number; tracks: number }
) {
  removeTexture(scene, bodyKey);
  removeTexture(scene, turretKey);

  const bodyPadding = 4;
  const bodyWidth = definition.hull.width + bodyPadding * 2;
  const bodyHeight = definition.hull.height;
  const trackHeight = Math.max(6, Math.round(bodyHeight * 0.23));
  graphics.clear();
  graphics
    .fillStyle(colors.tracks)
    .fillRoundedRect(0, 0, bodyWidth, trackHeight, 3)
    .fillRoundedRect(0, bodyHeight - trackHeight, bodyWidth, trackHeight, 3)
    .fillStyle(colors.primary)
    .fillRoundedRect(
      bodyPadding,
      2,
      definition.hull.width,
      bodyHeight - 4,
      definition.hull.cornerRadius
    )
    .lineStyle(2, colors.secondary, 0.9)
    .strokeRoundedRect(
      bodyPadding + 2,
      4,
      definition.hull.width - 4,
      bodyHeight - 8,
      Math.max(2, definition.hull.cornerRadius - 2)
    );
  drawHullDetails(graphics, definition, colors.secondary, bodyPadding);
  graphics.generateTexture(bodyKey, bodyWidth, bodyHeight);

  const turretPadding = 2;
  const turretDiameter = definition.turret.radius * 2;
  const turretWidth =
    turretPadding * 2 + turretDiameter + definition.turret.barrelLength;
  const turretHeight = turretPadding * 2 + turretDiameter;
  const center = turretPadding + definition.turret.radius;
  graphics.clear();
  graphics
    .fillStyle(colors.secondary)
    .fillRoundedRect(
      center,
      center - definition.turret.barrelWidth / 2,
      definition.turret.barrelLength + definition.turret.radius,
      definition.turret.barrelWidth,
      definition.turret.barrelWidth / 2
    )
    .fillStyle(colors.primary)
    .fillCircle(center, center, definition.turret.radius)
    .lineStyle(2, colors.secondary, 1)
    .strokeCircle(center, center, Math.max(2, definition.turret.radius - 2));
  graphics.generateTexture(turretKey, turretWidth, turretHeight);
}

function drawHullDetails(
  graphics: Phaser.GameObjects.Graphics,
  definition: TankVisualDefinition,
  color: number,
  padding: number
) {
  const middle = definition.hull.height / 2;
  if (definition.details.includes('front-star')) {
    graphics.fillStyle(color).fillCircle(padding + 10, middle, 4);
  }
  if (definition.details.includes('fox-ears')) {
    graphics.fillStyle(color);
    graphics.fillTriangle(padding + 8, 5, padding + 15, 5, padding + 11, 0);
    graphics.fillTriangle(padding + 22, 5, padding + 29, 5, padding + 26, 0);
  }
  if (definition.details.includes('armor-brow')) {
    graphics
      .fillStyle(color)
      .fillRect(padding + 4, 5, 18, 4)
      .fillRect(padding + 4, definition.hull.height - 9, 18, 4);
  }
  if (definition.details.includes('rear-vents')) {
    graphics.lineStyle(2, color, 0.9);
    for (
      let x = definition.hull.width - 10;
      x < definition.hull.width;
      x += 4
    ) {
      graphics.lineBetween(padding + x, middle - 6, padding + x, middle + 6);
    }
  }
  if (definition.details.includes('track-guards')) {
    graphics
      .lineStyle(3, color, 0.8)
      .lineBetween(padding + 10, 3, padding + definition.hull.width - 8, 3)
      .lineBetween(
        padding + 10,
        definition.hull.height - 3,
        padding + definition.hull.width - 8,
        definition.hull.height - 3
      );
  }
}

function removeTexture(scene: Phaser.Scene, key: string) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
}
