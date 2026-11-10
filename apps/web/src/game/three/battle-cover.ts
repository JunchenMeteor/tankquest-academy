import type { RuntimeLevelConfig } from '../runtime/types.js';
import type { BlockPlacement } from './battle-scene-model.js';

function seedFor(code: string): number {
  let seed = 17;
  for (const character of code)
    seed = (seed * 31 + character.charCodeAt(0)) >>> 0;
  return seed;
}

function objectivePoints(config: RuntimeLevelConfig) {
  return (config.objectiveSet?.objectives ?? []).flatMap((objective) => {
    if (objective.type === 'supply-run') return objective.points;
    if (objective.type === 'route-choice') return objective.checkpoints;
    return [];
  });
}

export function buildExtraCover(
  config: RuntimeLevelConfig,
  scale: number,
  heightAt: (x: number, z: number) => number
): BlockPlacement[] {
  const occupied = [
    config.playerSpawn,
    ...config.enemies,
    ...config.obstacles,
    ...objectivePoints(config),
  ];
  const seed = seedFor(
    `${config.mapStyle}:${config.theme}:${config.player.visualCode}`
  );
  const candidates = [180, 360, 540, 780].flatMap((x) =>
    [110, 270, 430].map((y) => ({ x, y }))
  );
  const accepted: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
  }> = [];

  for (const [index, candidate] of candidates.entries()) {
    const horizontal = (index + seed) % 2 === 0;
    const width = horizontal ? 96 : 30;
    const height = horizontal ? 30 : 96;
    if (
      occupied.some(
        (point) =>
          Math.abs(point.x - candidate.x) < (width + 90) / 2 + 45 &&
          Math.abs(point.y - candidate.y) < (height + 90) / 2 + 45
      ) ||
      accepted.some(
        (point) =>
          Math.abs(point.x - candidate.x) < 115 &&
          Math.abs(point.y - candidate.y) < 115
      )
    ) {
      continue;
    }
    accepted.push({ ...candidate, width, height });
    if (accepted.length === 6) break;
  }

  return accepted.map((cover) => {
    const x = (cover.x - config.width / 2) / scale;
    const z = (cover.y - config.height / 2) / scale;
    return {
      position: { x, y: heightAt(x, z) + 0.9, z },
      size: [cover.width / scale, 1.8, cover.height / scale],
    };
  });
}
