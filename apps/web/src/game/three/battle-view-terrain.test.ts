import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

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
});
