import { describe, expect, it } from 'vitest';

import { translate } from './I18nProvider.js';

describe('translate', () => {
  it('defaults business copy to English resources', () => {
    expect(translate('en', 'action.start')).toBe('Start training');
  });

  it('interpolates Chinese copy without changing the source data', () => {
    expect(translate('zh-CN', 'battle.remaining', { count: 3 })).toBe(
      '还剩 3 辆训练坦克'
    );
  });

  it('falls back to English and then to the key', () => {
    expect(translate('zh-CN', 'language.en')).toBe('English');
    expect(translate('en', 'unknown.key')).toBe('unknown.key');
  });
});
