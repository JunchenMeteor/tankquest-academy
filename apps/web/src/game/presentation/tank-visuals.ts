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

function shade(color: number, factor: number): number {
  const clamp = (value: number) =>
    Math.max(0, Math.min(255, Math.round(value)));
  const r = clamp(((color >> 16) & 0xff) * factor);
  const g = clamp(((color >> 8) & 0xff) * factor);
  const b = clamp((color & 0xff) * factor);
  return (r << 16) | (g << 8) | b;
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
  const hullInset = bodyPadding + 2;
  const hullWidth = definition.hull.width - 4;
  const hullHeight = bodyHeight - 8;

  const hullLight = shade(colors.primary, 1.28);
  const hullShade = shade(colors.primary, 0.72);
  const trackLight = shade(colors.tracks, 1.5);
  const trackShade = shade(colors.tracks, 0.6);

  graphics.clear();

  /* Tracks: dark base, tread ticks, top highlight so the rubber reads as metal. */
  graphics
    .fillStyle(colors.tracks)
    .fillRoundedRect(0, 0, bodyWidth, trackHeight, 3)
    .fillRoundedRect(0, bodyHeight - trackHeight, bodyWidth, trackHeight, 3);
  for (let x = 3; x < bodyWidth - 2; x += 5) {
    graphics
      .fillStyle(trackShade, 0.85)
      .fillRect(x, 1, 2, trackHeight - 2)
      .fillRect(x, bodyHeight - trackHeight + 1, 2, trackHeight - 2);
  }
  graphics
    .fillStyle(trackLight, 0.45)
    .fillRect(1, 0, bodyWidth - 2, 1)
    .fillRect(1, bodyHeight - trackHeight, bodyWidth - 2, 1);

  /* Hull: base plate, top-lit band, bottom shadow, double outline. */
  /* Extruded side face: a darker offset silhouette gives the hull height. */
  graphics
    .fillStyle(shade(colors.primary, 0.5), 0.55)
    .fillRoundedRect(
      bodyPadding + 3,
      5,
      definition.hull.width,
      bodyHeight - 6,
      definition.hull.cornerRadius
    )
    .fillStyle(colors.primary)
    .fillRoundedRect(
      bodyPadding,
      2,
      definition.hull.width,
      bodyHeight - 4,
      definition.hull.cornerRadius
    )
    .fillStyle(hullLight, 0.45)
    .fillRoundedRect(
      bodyPadding + 1,
      3,
      definition.hull.width - 2,
      Math.max(4, (bodyHeight - 6) * 0.42),
      Math.max(2, definition.hull.cornerRadius - 2)
    )
    .fillStyle(hullShade, 0.32)
    .fillRoundedRect(
      bodyPadding + 1,
      bodyHeight - 4 - Math.max(4, (bodyHeight - 6) * 0.28),
      definition.hull.width - 2,
      Math.max(3, (bodyHeight - 6) * 0.28),
      Math.max(2, definition.hull.cornerRadius - 3)
    )
    .lineStyle(2, colors.secondary, 0.85)
    .strokeRoundedRect(
      hullInset,
      4,
      hullWidth,
      hullHeight,
      Math.max(2, definition.hull.cornerRadius - 2)
    )
    .lineStyle(1, hullLight, 0.5)
    .strokeRoundedRect(
      hullInset + 2,
      6,
      hullWidth - 4,
      hullHeight - 4,
      Math.max(2, definition.hull.cornerRadius - 3)
    );

  /* Rivets along both long edges. */
  for (
    let x = bodyPadding + 6;
    x < bodyPadding + definition.hull.width - 4;
    x += 9
  ) {
    graphics
      .fillStyle(hullShade, 0.9)
      .fillCircle(x, 7, 1.1)
      .fillCircle(x, bodyHeight - 7, 1.1)
      .fillStyle(hullLight, 0.7)
      .fillCircle(x - 0.4, 6.6, 0.5);
  }

  drawHullDetails(graphics, definition, colors.secondary, bodyPadding);
  graphics.generateTexture(bodyKey, bodyWidth, bodyHeight);

  const turretPadding = 2;
  const turretDiameter = definition.turret.radius * 2;
  const turretWidth =
    turretPadding * 2 + turretDiameter + definition.turret.barrelLength;
  const turretHeight = turretPadding * 2 + turretDiameter;
  const center = turretPadding + definition.turret.radius;
  const barrelTop = center - definition.turret.barrelWidth / 2;
  const turretLight = shade(colors.primary, 1.35);
  const turretShade = shade(colors.primary, 0.7);

  graphics.clear();

  /* Barrel: base, top highlight, muzzle brake. */
  graphics
    .fillStyle(colors.secondary)
    .fillRoundedRect(
      center,
      barrelTop,
      definition.turret.barrelLength + definition.turret.radius,
      definition.turret.barrelWidth,
      definition.turret.barrelWidth / 2
    )
    .fillStyle(shade(colors.secondary, 1.25), 0.55)
    .fillRect(
      center + 2,
      barrelTop + 0.6,
      definition.turret.barrelLength + definition.turret.radius - 4,
      1
    )
    .fillStyle(turretShade, 0.8)
    .fillRect(
      center + 2,
      barrelTop + definition.turret.barrelWidth - 1.6,
      definition.turret.barrelLength + definition.turret.radius - 4,
      1
    )
    .fillStyle(colors.secondary)
    .fillRoundedRect(
      center + definition.turret.barrelLength - 2,
      barrelTop - 1,
      6,
      definition.turret.barrelWidth + 2,
      2
    );

  /* Turret: layered discs fake a top-left light source. */
  graphics
    .fillStyle(shade(colors.primary, 0.45), 0.5)
    .fillCircle(center + 1.6, center + 2, definition.turret.radius)
    .fillStyle(colors.primary)
    .fillCircle(center, center, definition.turret.radius)
    .fillStyle(turretLight, 0.5)
    .fillCircle(
      center - definition.turret.radius * 0.22,
      center - definition.turret.radius * 0.26,
      definition.turret.radius * 0.72
    )
    .fillStyle(turretShade, 0.28)
    .fillCircle(
      center + definition.turret.radius * 0.18,
      center + definition.turret.radius * 0.24,
      definition.turret.radius * 0.55
    )
    .lineStyle(2, colors.secondary, 1)
    .strokeCircle(center, center, Math.max(2, definition.turret.radius - 1))
    .lineStyle(1, turretLight, 0.6)
    .strokeCircle(center, center, Math.max(2, definition.turret.radius - 3))
    .fillStyle(turretShade, 0.85)
    .fillCircle(
      center - definition.turret.radius * 0.15,
      center - definition.turret.radius * 0.2,
      Math.max(1.6, definition.turret.radius * 0.22)
    )
    .fillStyle(turretLight, 0.75)
    .fillCircle(
      center - definition.turret.radius * 0.22,
      center - definition.turret.radius * 0.28,
      Math.max(1, definition.turret.radius * 0.12)
    );
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
