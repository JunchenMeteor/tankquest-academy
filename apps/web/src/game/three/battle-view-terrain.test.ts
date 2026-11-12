import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { groundHeight } from './battle-scene-model.js';

const source = readFileSync(
  new URL('./battle-view.ts', import.meta.url),
  'utf8'
);

describe('terrain-fitted rig transforms', () => {
  it('does not restore the player centre height after fitting the hull', () => {
    expect(source).not.toMatch(
      /playerRig\.root\.position\.copy\(\s*new Vector3\(state\.position\.x,\s*state\.position\.y,\s*state\.position\.z\)\s*\)/
    );
  });

  it('does not assign moving enemy centre height more than once per frame', () => {
    const assignments = source.matchAll(
      /root\.position\.set\(\s*enemy\.position\.x,\s*enemy\.position\.y,\s*enemy\.position\.z\s*\)/g
    );
    expect([...assignments].length).toBeLessThanOrEqual(1);
  });

  it('keeps the distant skirt below every playable terrain valley', () => {
    const skirtHeight = Number(
      /skirt\.position\.y = (-?\d+(?:\.\d+)?);/.exec(source)?.[1]
    );
    let lowestTerrain = Infinity;
    for (let x = -50; x <= 50; x += 1) {
      for (let z = -50; z <= 50; z += 1) {
        lowestTerrain = Math.min(lowestTerrain, groundHeight(x, z));
      }
    }
    expect(skirtHeight).toBeLessThan(lowestTerrain);
  });
});
