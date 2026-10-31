import { describe, expect, it } from 'vitest';

import { themeAtmosphereDefinition } from './theme-atmosphere.js';

describe('theme atmosphere definitions', () => {
  it('keeps themes visually distinct and object counts bounded', () => {
    const definitions = [
      themeAtmosphereDefinition('training-base'),
      themeAtmosphereDefinition('forest-camp'),
      themeAtmosphereDefinition('snow-field'),
    ];

    expect(definitions.map((definition) => definition.kind)).toEqual([
      'scanner',
      'leaves',
      'snow',
    ]);
    expect(
      new Set(definitions.map((definition) => definition.color)).size
    ).toBe(3);
    expect(
      definitions.every(
        (definition) => definition.count > 0 && definition.count <= 18
      )
    ).toBe(true);
  });
});
