import { describe, expect, it } from 'vitest';

import { ramImpactText, shellImpactText } from './battle-hit-feedback.js';

describe('combat hit feedback text', () => {
  it('explains damage and its armour zone in Chinese', () => {
    expect(
      shellImpactText(
        { damage: 31, zone: 'front', outcome: 'penetrated' },
        'zh-CN'
      )
    ).toEqual({ text: '正面击穿 · -31', color: '#ff9a7a' });
  });

  it('distinguishes blocked shots and ricochets in English', () => {
    expect(
      shellImpactText({ damage: 0, zone: 'side', outcome: 'blocked' }, 'en')
        .text
    ).toBe('Side armour held');
    expect(
      shellImpactText({ damage: 0, zone: 'rear', outcome: 'ricochet' }, 'en')
        .text
    ).toBe('Rear ricochet');
  });

  it('localizes ram damage without treating it as an armour penetration', () => {
    expect(ramImpactText(45, 'zh-CN').text).toBe('撞击伤害 · -45');
    expect(ramImpactText(20, 'en').text).toBe('Ram damage · -20');
  });
});
