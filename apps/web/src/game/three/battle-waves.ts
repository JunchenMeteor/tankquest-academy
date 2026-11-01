/**
 * Splits the enemy group into waves.
 *
 * Easy fights put every tank on the field at once; harder ones arrive in
 * successive waves, so the player faces steady pressure instead of one volley.
 */
export function planWaves(count: number, difficulty: number): number[][] {
  if (count <= 0) return [];
  const clamped = Math.max(0, Math.min(1, difficulty));
  const waveCount = 1 + Math.round(clamped * 2);
  if (waveCount <= 1 || count <= 2)
    return [Array.from({ length: count }, (_, index) => index)];

  const waves: number[][] = [];
  const perWave = Math.ceil(count / waveCount);
  for (let index = 0; index < count; index += 1) {
    const wave = Math.floor(index / perWave);
    waves[wave] ??= [];
    waves[wave]!.push(index);
  }
  return waves;
}
